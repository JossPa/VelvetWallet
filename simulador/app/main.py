# -*- coding: utf-8 -*-
"""
Entidad Financiera Simulada (EFS) — Sistema de Finanzas Abiertas (Chile)

Finge ser una Institución Proveedora de Cuentas (IPC) participante del SFA.
Implementa la API de Cuentas conforme al OpenAPI publicado por la CMF
(spec/Accounts.yaml), siguiendo el enfoque del Sandbox Tecnológico ATENA: una
EFS contra la cual un participante (p. ej. un PSBI como Velvet Wallet) prueba la
integración, autenticación y consumo de APIs.

Flujo de seguridad simulado (alineado con la guía ATENA):
  1. El participante obtiene un token por Client Credentials  (POST /token)
  2. Solicita un consentimiento con alcance RAR                (POST /consents)
  3. El usuario autoriza y se emite un token de acceso         (POST /consents/{id}/authorise)
  4. Con ese token se leen los datos                           (GET /accounts/...)

Todavía sin mTLS, sin firma JWS y sin DCR: esas capas se agregan después, sobre
algo que ya funciona (igual que en ATENA, donde los certificados son autofirmados).

Levantar con:  uvicorn app.main:app --reload --port 8001
"""
import os
import random
import secrets
from datetime import date, datetime, timezone, timedelta
from urllib.parse import urlencode

from fastapi import FastAPI, HTTPException, Query, Path, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.datos import CUENTAS, SALDOS, MOVIMIENTOS

# El backend de Velvet Wallet corre en el 8000. La EFS va en el 8001
# para que se puedan levantar los dos a la vez.
BASE = "http://localhost:8001/accounts/v1"

app = FastAPI(
    title="Entidad Financiera Simulada (EFS) — SFA Chile",
    version="2.0.0",
    description=(
        "EFS conforme a la API de Cuentas del Sistema de Finanzas Abiertas, "
        "según el enfoque del Sandbox Tecnológico ATENA de la CMF. Simula la "
        "autenticación del participante (Client Credentials), el consentimiento "
        "con alcance RAR y el consumo de datos con token."
    ),
    root_path="",
)

# Permite que la app (que corre en otro puerto, p. ej. 8081 en web) pida datos
# a esta API desde el navegador. En desarrollo se abre a todo; un banco real
# restringiría a los orígenes autorizados.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
#  Seguridad: token del participante, consentimiento y token de acceso
#
#  Alineado con el "Marco técnico de seguridad" de la guía ATENA:
#    · Client Credentials  → token del participante (prueba de identidad).
#    · Rich Authorization Request (RAR) → alcance del consentimiento.
#    · Token de acceso emitido al autorizar el consentimiento.
#
#  Lo que en ATENA está sobre esto (DCR, firma JWS, mTLS) queda pendiente:
#  se construye encima de un flujo que ya funciona.
# ═══════════════════════════════════════════════════════════════════

# Interruptor: si está en "false", los endpoints NO exigen token (útil para que
# la vista en vivo de la app, que hoy llama sin token, siga funcionando mientras
# no se la apunte al backend). Por defecto EXIGE token.
EXIGIR_TOKEN = os.getenv("SFA_EXIGIR_TOKEN", "true").lower() in ("1", "true", "yes", "si", "sí")

# Credenciales del participante (en ATENA se obtienen al habilitarse; aquí son
# fijas para la demo). El participante es Velvet Wallet, en su rol de PSBI.
CLIENTE_ID = os.getenv("SFA_CLIENTE_ID", "velvet-wallet")
CLIENTE_SECRET = os.getenv("SFA_CLIENTE_SECRET", "secreto-demo")

# Permisos que el estándar define (RAR — Rich Authorization Requests). El
# consentimiento dice a qué datos se accede; el token de acceso hereda ese alcance.
PERMISOS_VALIDOS = {
    "ReadAccountsBasic", "ReadAccountsDetail",
    "ReadBalances",
    "ReadTransactionsBasic", "ReadTransactionsDetail",
}

# Almacenes en memoria. Se reinician al reiniciar el servidor, igual que los
# datos (que se cargan del JSON al arrancar). No es una base de datos: es una EFS.
PARTICIPANTES: dict[str, dict] = {}     # token de participante -> {expira}
CONSENTIMIENTOS: dict[str, dict] = {}   # consentId -> datos del consentimiento
TOKENS: dict[str, dict] = {}            # token de acceso -> {consentId, expira, permisos}

_bearer = HTTPBearer(auto_error=False)


def exigir_token_participante(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict | None:
    """
    Valida el token del participante (el obtenido por Client Credentials). Es el
    que prueba que quien llama es un participante habilitado. Se exige para crear
    un consentimiento.
    """
    if not EXIGIR_TOKEN:
        return None
    if cred is None or not cred.credentials:
        raise HTTPException(
            status_code=401,
            detail="Falta el token del participante. Obténgalo primero en POST /token (Client Credentials).",
        )
    info = PARTICIPANTES.get(cred.credentials)
    if info is None:
        raise HTTPException(status_code=401, detail="Token de participante inválido o desconocido.")
    if info["expira"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="El token del participante expiró. Pida uno nuevo.")
    return info


def exigir_token_acceso(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict | None:
    """
    Valida el token de acceso a datos (el emitido al autorizar el consentimiento).
    Se exige en los endpoints de datos: sin consentimiento autorizado, no hay datos.
    """
    if not EXIGIR_TOKEN:
        return None
    if cred is None or not cred.credentials:
        raise HTTPException(
            status_code=401,
            detail="Falta el token de acceso. Se requiere un consentimiento autorizado (Authorization: Bearer).",
        )
    info = TOKENS.get(cred.credentials)
    if info is None:
        raise HTTPException(status_code=401, detail="Token de acceso inválido o desconocido.")
    if info["expira"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="El consentimiento expiró. Debe renovarse.")
    return info


class SolicitudToken(BaseModel):
    """Client Credentials: el participante se autentica con su id y secreto."""
    grant_type: str = Field("client_credentials", description="Debe ser 'client_credentials'.")
    client_id: str = Field(..., description="Identificador del participante.")
    client_secret: str = Field(..., description="Secreto del participante.")
    scope: str | None = None


class SolicitudConsentimiento(BaseModel):
    """Lo que la app pide: a qué datos quiere acceder y hasta cuándo (RAR)."""
    permissions: list[str] = Field(
        default_factory=lambda: ["ReadAccountsBasic", "ReadBalances", "ReadTransactionsDetail"],
        description="Permisos solicitados (RAR — Rich Authorization Request).",
    )
    expirationDateTime: datetime | None = Field(
        None, description="Hasta cuándo rige el consentimiento. Por defecto, 90 días."
    )


# ───────────────────────── utilidades ─────────────────────────
def paginar(items, page, page_size, ruta, extra=None):
    """
    Corta la lista en páginas y arma los bloques 'links' y 'meta' que el
    estándar exige en toda respuesta.
    """
    total = len(items)
    total_pages = max(1, -(-total // page_size))  # división hacia arriba
    ini = (page - 1) * page_size
    trozo = items[ini:ini + page_size]

    def url(p):
        q = dict(extra or {})
        q.update({"page": p, "pageSize": page_size})
        return "%s%s?%s" % (BASE, ruta, urlencode(q))

    links = {"self": url(page), "first": url(1), "last": url(total_pages)}
    if page > 1:
        links["prev"] = url(page - 1)
    if page < total_pages:
        links["next"] = url(page + 1)

    fechas = [i["bookingDateTime"] for i in items if "bookingDateTime" in i]
    meta = {
        "firstAvailableDateTime": min(fechas) if fechas else datetime.now().astimezone(),
        "lastAvailableDateTime": max(fechas) if fechas else datetime.now().astimezone(),
        "totalPages": total_pages,
    }
    return trozo, links, meta


def sin_internos(movimiento):
    """
    Quita los campos que empiezan con guion bajo antes de responder.

    '_pendiente' y '_monto_final' son información interna de la EFS: un banco
    real sabe que una transacción está pendiente, pero esta API no tiene campo
    para decirlo. Si los enviáramos, dejaríamos de ser conformes.
    """
    return {k: v for k, v in movimiento.items() if not k.startswith("_")}


def cuenta_o_404(account_id):
    c = next((c for c in CUENTAS if c["accountId"] == account_id), None)
    if c is None:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return c


# ───────────────────────── operación ─────────────────────────
@app.get("/health", tags=["Operación"], summary="Comprobación de vida")
def health():
    return {"ok": True, "servicio": "efs-sfa", "cuentas": len(CUENTAS),
            "exige_token": EXIGIR_TOKEN}


# ───────────────────────── autenticación del participante ─────────────────────────
@app.post("/accounts/v1/token", tags=["Autenticación"],
          summary="0) Token del participante (Client Credentials)")
def emitir_token_participante(sol: SolicitudToken):
    """
    Paso 1 de la guía ATENA ('Crear Token del Participante'). El participante se
    autentica con su client_id/client_secret y recibe un access_token que prueba
    su identidad. Con él puede, luego, solicitar consentimientos.

    (En OAuth real este endpoint recibe los datos como formulario y vive en el
    servidor de autorización; aquí se simplifica a JSON para poder probarlo.)
    """
    if sol.grant_type != "client_credentials":
        raise HTTPException(status_code=400, detail="grant_type debe ser 'client_credentials'.")
    if sol.client_id != CLIENTE_ID or sol.client_secret != CLIENTE_SECRET:
        raise HTTPException(status_code=401, detail="Credenciales de participante inválidas (invalid_client).")

    token = secrets.token_urlsafe(32)
    expira = datetime.now(timezone.utc) + timedelta(hours=1)
    PARTICIPANTES[token] = {"expira": expira, "client_id": sol.client_id}
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": sol.scope or "accounts",
    }


# ───────────────────────── consentimiento ─────────────────────────
@app.post("/accounts/v1/consents", tags=["Consentimiento"],
          summary="1) Solicitar consentimiento (requiere token de participante)")
def crear_consentimiento(sol: SolicitudConsentimiento,
                         _participante: dict | None = Depends(exigir_token_participante)):
    """
    La app (ya identificada con su token de participante) declara a qué datos
    quiere acceder (RAR). La EFS registra la solicitud como 'AwaitingAuthorisation'
    (esperando que el usuario la apruebe).
    """
    invalidos = [p for p in sol.permissions if p not in PERMISOS_VALIDOS]
    if invalidos:
        raise HTTPException(status_code=422, detail="Permisos no reconocidos: %s" % invalidos)

    consent_id = "urn:velvet:consent:" + secrets.token_hex(8)
    ahora = datetime.now(timezone.utc)
    expira = sol.expirationDateTime or (ahora + timedelta(days=90))
    CONSENTIMIENTOS[consent_id] = {
        "consentId": consent_id,
        "status": "AwaitingAuthorisation",
        "permissions": sol.permissions,
        "creationDateTime": ahora,
        "expirationDateTime": expira,
    }
    _, links, meta = paginar([], 1, 1, "/consents")
    links["self"] = "%s/consents/%s" % (BASE, consent_id)
    return {"data": CONSENTIMIENTOS[consent_id], "links": links, "meta": meta}


@app.post("/accounts/v1/consents/{consentId}/authorise", tags=["Consentimiento"],
          summary="2) Autorizar (el usuario aprueba en el banco) y emitir token de acceso")
def autorizar_consentimiento(consentId: str = Path(...)):
    """
    Representa el momento en que el usuario entra a su banco y aprueba el acceso.
    En el SFA real esto es un login + redirección (flujo de autorización); aquí
    es una llamada. Al aprobar, la EFS emite un token de acceso ligado a este
    consentimiento, con el que se leen los datos.
    """
    c = CONSENTIMIENTOS.get(consentId)
    if c is None:
        raise HTTPException(status_code=404, detail="Consentimiento no encontrado.")

    c["status"] = "Authorised"
    token = secrets.token_urlsafe(32)
    expira = c["expirationDateTime"]
    TOKENS[token] = {"consentId": consentId, "expira": expira, "permisos": c["permissions"]}
    segundos = max(0, int((expira - datetime.now(timezone.utc)).total_seconds()))
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": segundos,
        "consentId": consentId,
        "scope": " ".join(c["permissions"]),
    }


@app.get("/accounts/v1/consents/{consentId}", tags=["Consentimiento"],
         summary="Estado de un consentimiento")
def ver_consentimiento(consentId: str = Path(...)):
    c = CONSENTIMIENTOS.get(consentId)
    if c is None:
        raise HTTPException(status_code=404, detail="Consentimiento no encontrado.")
    return {"data": c, "links": {"self": "%s/consents/%s" % (BASE, consentId)}, "meta": {}}


# ───────────────────────── cuentas (protegidas por token de acceso) ─────────────────────────
@app.get("/accounts/v1/accounts", tags=["Cuentas"],
         summary="Listado de cuentas del cliente")
def listar_cuentas(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    x_fapi_interaction_id: str | None = Header(None, alias="x-fapi-interaction-id"),
    _acceso: dict | None = Depends(exigir_token_acceso),
):
    datos, links, meta = paginar(CUENTAS, page, pageSize, "/accounts")
    return {"data": {"accounts": datos}, "links": links, "meta": meta}


@app.get("/accounts/v1/accounts/{accountID}", tags=["Cuentas"],
         summary="Detalle de una cuenta")
def detalle_cuenta(accountID: str = Path(...),
                   _acceso: dict | None = Depends(exigir_token_acceso)):
    c = cuenta_o_404(accountID)
    _, links, meta = paginar([c], 1, 1, "/accounts/%s" % accountID)
    return {"data": {"account": c}, "links": links, "meta": meta}


@app.get("/accounts/v1/accounts/{accountID}/balance", tags=["Cuentas"],
         summary="Saldos de la cuenta")
def saldo_cuenta(accountID: str = Path(...),
                 _acceso: dict | None = Depends(exigir_token_acceso)):
    cuenta_o_404(accountID)
    s = SALDOS.get(accountID, {"amount": 0.0, "currency": "CLP", "type": "Disponible"})
    _, links, meta = paginar([], 1, 1, "/accounts/%s/balance" % accountID)
    return {"data": {"balance": s}, "links": links, "meta": meta}


@app.get("/accounts/v1/accounts/{accountID}/transactions", tags=["Cuentas"],
         summary="Movimientos de la cuenta")
def movimientos_cuenta(
    accountID: str = Path(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    fromDate: date | None = Query(None, description="Filtra desde esta fecha"),
    toDate: date | None = Query(None, description="Filtra hasta esta fecha"),
    _acceso: dict | None = Depends(exigir_token_acceso),
):
    cuenta_o_404(accountID)
    movs = list(MOVIMIENTOS.get(accountID, []))

    # Filtro por fecha: esto es lo que permite la sincronización incremental,
    # pedir solo lo nuevo desde la última consulta.
    if fromDate:
        movs = [m for m in movs if m["bookingDateTime"].date() >= fromDate]
    if toDate:
        movs = [m for m in movs if m["bookingDateTime"].date() <= toDate]

    movs.sort(key=lambda m: m["bookingDateTime"], reverse=True)

    extra = {}
    if fromDate:
        extra["fromDate"] = fromDate.isoformat()
    if toDate:
        extra["toDate"] = toDate.isoformat()

    datos, links, meta = paginar(
        movs, page, pageSize, "/accounts/%s/transactions" % accountID, extra)
    return {
        "data": {"transactions": [sin_internos(m) for m in datos]},
        "links": links,
        "meta": meta,
    }


# Los dos endpoints de sobregiro existen en el estándar pero no los usamos:
# se declaran para que la EFS sea completa, devolviendo vacío.
@app.get("/accounts/v1/accounts/{accountID}/overdraft", tags=["Cuentas"],
         summary="Movimientos de sobregiro")
def sobregiro(accountID: str = Path(...),
              _acceso: dict | None = Depends(exigir_token_acceso)):
    cuenta_o_404(accountID)
    _, links, meta = paginar([], 1, 1, "/accounts/%s/overdraft" % accountID)
    return {"data": {"overdraft": []}, "links": links, "meta": meta}


@app.get("/accounts/v1/accounts/{accountID}/current-overdraft-limit",
         tags=["Cuentas"], summary="Límite de sobregiro vigente")
def limite_sobregiro(accountID: str = Path(...),
                     _acceso: dict | None = Depends(exigir_token_acceso)):
    cuenta_o_404(accountID)
    _, links, meta = paginar([], 1, 1,
                             "/accounts/%s/current-overdraft-limit" % accountID)
    return {"data": {"currentOverdraftLimit": []}, "links": links, "meta": meta}


# ═══════════════════════════════════════════════════════════════════
#  Control de la EFS
#
#  Estos endpoints NO son parte del estándar. Van bajo otro prefijo
#  justamente para dejarlo claro: un banco real no tiene un botón para
#  adelantar el tiempo. Existen solo para poder probar qué hace la
#  ingesta cuando un movimiento cambia de monto entre sincronizaciones.
# ═══════════════════════════════════════════════════════════════════
@app.get("/simulador/estado", tags=["Simulador"],
         summary="Qué movimientos están pendientes de confirmar")
def estado_simulador():
    pendientes = []
    for cuenta, movs in MOVIMIENTOS.items():
        for m in movs:
            if m.get("_pendiente"):
                pendientes.append({
                    "cuenta": cuenta,
                    "transactionID": m["transactionID"],
                    "comercio": m.get("merchantDetails", {}).get("name"),
                    "monto_actual": m["amount"],
                    "monto_al_confirmar": m["_monto_final"],
                })
    return {"pendientes": len(pendientes), "movimientos": pendientes}


@app.post("/simulador/avanzar", tags=["Simulador"],
          summary="Confirma los movimientos pendientes")
def avanzar_simulador():
    """
    Simula el paso del tiempo: las compras pre-autorizadas se confirman y
    su monto pasa al definitivo.

    El transactionID NO cambia — es el mismo movimiento. Eso es justo lo que
    tiene que detectar la ingesta para actualizar en vez de insertar.
    """
    confirmados = []
    for cuenta, movs in MOVIMIENTOS.items():
        for m in movs:
            if m.get("_pendiente"):
                antes = m["amount"]
                m["amount"] = m["_monto_final"]
                m["_pendiente"] = False
                confirmados.append({
                    "cuenta": cuenta,
                    "transactionID": m["transactionID"],
                    "monto_antes": antes,
                    "monto_despues": m["amount"],
                })

    return {
        "confirmados": len(confirmados),
        "movimientos": confirmados,
        "nota": ("Para volver al estado inicial, reinicia el servidor: "
                 "los datos se cargan del JSON al arrancar."),
    }


# Comercios de ejemplo para inventar un movimiento nuevo (demo en vivo).
_COMERCIOS_DEMO = [
    {"name": "Lider", "category": "Alimentos"},
    {"name": "Copec", "category": "Transporte"},
    {"name": "Uber Eats", "category": "Restaurantes"},
    {"name": "Falabella", "category": "Vestuario"},
    {"name": "Farmacias Ahumada", "category": "Salud"},
    {"name": "Jumbo", "category": "Alimentos"},
]
_contador_demo = {"n": 0}


@app.post("/simulador/nuevo", tags=["Simulador"],
          summary="Crea un movimiento nuevo (demo en vivo)")
def nuevo_movimiento(accountID: str = "CTA-0001"):
    """
    Inyecta un movimiento nuevo en la cuenta, como si el cliente acabara de
    hacer una compra. Queda disponible de inmediato en el endpoint de
    movimientos: es lo que la app consume en vivo por la API.

    NO es parte del estándar — es un botón para demostrar el flujo. Al reiniciar
    el servidor, los datos vuelven al JSON original.
    """
    cuenta_o_404(accountID)
    _contador_demo["n"] += 1
    ahora = datetime.now(timezone.utc)
    comercio = random.choice(_COMERCIOS_DEMO)

    # Se fecha "ahora": la compra recién ocurrida. Es la más reciente entre las
    # que ya pasaron, así aparece arriba tanto en la pantalla en vivo como en el
    # resto de la app (que solo muestra lo ocurrido hasta el momento).
    movs = MOVIMIENTOS.setdefault(accountID, [])
    mov = {
        "transactionID": "TXN-LIVE-%s-%03d" % (ahora.strftime("%m%d%H%M%S"),
                                               _contador_demo["n"]),
        "bookingDateTime": ahora,
        "transactionsType": "Cargo",
        "amount": float(random.randrange(2000, 60000, 10)),
        "currency": "CLP",
        "merchantDetails": comercio,
    }
    movs.append(mov)

    return {"creado": sin_internos(mov), "total_cuenta": len(movs)}
