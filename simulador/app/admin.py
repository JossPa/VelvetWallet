# -*- coding: utf-8 -*-
"""
Consola de administración de la EFS:  http://localhost:8001/admin

Control completo del banco simulado desde el navegador:

  · Estado y configuración: exigir o no token, cliente por defecto.
  · Clientes: crear, renombrar, cambiar clave, eliminar.
  · Cuentas: estado y apodo.
  · Movimientos: ver todos (con los campos internos), crear cargos o abonos
    con fecha libre, editar, eliminar, confirmar pendientes.
  · Créditos: crear, pagar cuotas, marcar mora, eliminar.
  · Permisos: consentimientos, tokens de acceso y de renovación; revocar
    uno o todos.
  · Fallas: hacer que la API del estándar responda con error o lento, para
    probar que Velvet aguanta la caída de un banco (RF-07).
  · Restablecer: volver a los datos de base sin reiniciar el proceso.

Igual que /panel y /simulador/*, NO es parte del estándar: un banco real no
tiene nada de esto. A diferencia de ellos, sí cambia cosas delicadas (borra
datos, revoca permisos, tumba la API), así que todo /admin/api/* pide la clave
de administración en la cabecera X-Admin-Clave (variable SFA_ADMIN_CLAVE).
"""
from __future__ import annotations

import asyncio
import importlib
import os
import random
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from app import banco
from app import clientes as C
from app import datos

# La clave de administración. Sin variable se usa una de demostración, y se
# avisa en la consola: sirve en el equipo propio, no en un servidor compartido.
CLAVE_ADMIN = os.getenv("SFA_ADMIN_CLAVE", "").strip()
if not CLAVE_ADMIN:
    CLAVE_ADMIN = "admin"
    print("[admin] SFA_ADMIN_CLAVE no está definida: la clave de /admin es 'admin'.")


def _main():
    """El módulo principal, leído en cada llamada (evita el import circular)."""
    from app import main
    return main


def exigir_admin(x_admin_clave: str | None = Header(None)) -> None:
    if not x_admin_clave or not secrets.compare_digest(x_admin_clave, CLAVE_ADMIN):
        raise HTTPException(status_code=401, detail="Clave de administración incorrecta.")


router = APIRouter(prefix="/admin/api", tags=["Administración"],
                   dependencies=[Depends(exigir_admin)])


# ═════════════════════════ fallas simuladas ═════════════════════════
# Qué le pasa a la API del estándar. Se aplica solo a /accounts/v1/* y al
# sitio de autorización: /admin, /panel y /health siguen respondiendo, para
# poder apagar la falla desde el mismo navegador.
FALLAS: dict = {
    "modo": "ninguna",      # ninguna | error | lento | caido
    "codigo": 503,          # con "error": el código HTTP que responde
    "demora_ms": 3000,      # con "lento": cuánto tarda cada respuesta
    "probabilidad": 100,    # % de las llamadas afectadas (0-100)
    "afectadas": 0,         # contador, para ver que la falla está pegando
}

_RUTAS_CON_FALLA = ("/accounts/v1", "/autorizar")


async def inyectar_fallas(request: Request, call_next):
    """Middleware: aplica FALLAS a las rutas del estándar."""
    modo = FALLAS["modo"]
    if (modo != "ninguna" and request.url.path.startswith(_RUTAS_CON_FALLA)
            and random.uniform(0, 100) < FALLAS["probabilidad"]):
        FALLAS["afectadas"] += 1
        if modo == "lento":
            await asyncio.sleep(FALLAS["demora_ms"] / 1000)
        elif modo == "caido":
            # Lo más parecido a un servidor caído sin cerrar el proceso: una
            # espera más larga que cualquier timeout razonable del cliente.
            await asyncio.sleep(120)
            return JSONResponse({"detail": "Servicio no disponible (falla simulada)."},
                                status_code=503)
        else:
            return JSONResponse(
                {"detail": "Falla simulada desde /admin (código %d)." % FALLAS["codigo"]},
                status_code=FALLAS["codigo"])
    return await call_next(request)


class ConfigFallas(BaseModel):
    modo: str = Field("ninguna", pattern="^(ninguna|error|lento|caido)$")
    codigo: int = Field(503, ge=400, le=599)
    demora_ms: int = Field(3000, ge=0, le=60_000)
    probabilidad: int = Field(100, ge=0, le=100)


@router.put("/fallas", summary="Configura la falla simulada de la API")
def configurar_fallas(cfg: ConfigFallas):
    FALLAS.update(cfg.model_dump())
    FALLAS["afectadas"] = 0
    return FALLAS


# ═════════════════════════ estado y configuración ═════════════════════════
def _ahora():
    return datetime.now(timezone.utc)


def _mascara(token: str) -> str:
    return token[:6] + "…" + token[-4:] if len(token) > 12 else "…"


@router.get("/estado", summary="Resumen de todo lo que hay en la EFS")
def estado():
    M = _main()
    ahora = _ahora()
    consent = list(M.CONSENTIMIENTOS.values())
    return {
        "banco": {"id": banco.ID, "nombre": banco.NOMBRE, "dominio": banco.DOMINIO},
        "config": {
            "exige_token": M.EXIGIR_TOKEN,
            "cliente_por_defecto": M.CLIENTE_POR_DEFECTO,
            "client_id": M.CLIENTE_ID,
        },
        "participantes_registrados": [
            {"client_id": cid, **info} for cid, info in M.PARTICIPANTES_REGISTRADOS.items()],
        "fallas": FALLAS,
        "conteos": {
            "clientes": len(C.CLIENTES),
            "cuentas": len(C.DUENO_CUENTA),
            "creditos": len(C.DUENO_CREDITO),
            "movimientos": sum(len(v) for c in C.CLIENTES.values()
                               for v in c["movimientos"].values()),
            "pendientes": sum(1 for c in C.CLIENTES.values() for v in c["movimientos"].values()
                              for m in v if m.get("_pendiente")),
            "tokens_participante": sum(1 for i in M.PARTICIPANTES.values() if i["expira"] > ahora),
            "consentimientos": len(consent),
            "consentimientos_autorizados": sum(1 for c in consent if c["status"] == "Authorised"),
            "tokens_acceso": sum(1 for i in M.TOKENS.values() if i["expira"] > ahora),
            "refresh_tokens": len(M.REFRESH),
            "solicitudes_par": len(M.SOLICITUDES_PAR),
        },
    }


class Config(BaseModel):
    exige_token: bool | None = None
    cliente_por_defecto: str | None = Field(
        None, description="RUT al que se atribuye una autorización sin RUT; '' = exigir RUT")


@router.put("/config", summary="Cambia la configuración en caliente")
def configurar(cfg: Config):
    M = _main()
    if cfg.exige_token is not None:
        M.EXIGIR_TOKEN = cfg.exige_token
    if cfg.cliente_por_defecto is not None:
        rut = cfg.cliente_por_defecto.strip()
        if rut and C.cliente_por_rut(rut) is None:
            raise HTTPException(status_code=404, detail="No hay un cliente con RUT %s" % rut)
        M.CLIENTE_POR_DEFECTO = C.normalizar_rut(rut) if rut else ""
    return estado()["config"]


# ═════════════════════════ clientes ═════════════════════════
def _cliente(rut: str) -> dict:
    cliente = C.cliente_por_rut(rut)
    if cliente is None:
        raise HTTPException(status_code=404, detail="No hay un cliente con RUT %s" % rut)
    return cliente


def _vista_cliente(cliente: dict) -> dict:
    M = _main()
    cuentas = []
    for c in cliente["cuentas"]:
        movs = cliente["movimientos"].get(c["accountId"], [])
        cuentas.append({**c, "saldo": M.saldo_de(cliente, c["accountId"])["amount"],
                        "movimientos": len(movs)})
    rut_n = cliente["rut_normalizado"]
    return {
        **C.resumen(cliente),
        "cuentas": cuentas,
        "creditos": cliente.get("creditos", []),
        "permisos_vigentes": sum(1 for i in M.REFRESH.values() if i.get("rut") == rut_n),
    }


@router.get("/clientes", summary="Todos los clientes con cuentas, saldos y créditos")
def listar_clientes():
    return {"clientes": [_vista_cliente(c) for c in C.CLIENTES.values()],
            "perfiles": [p for p in C.PERFILES]}


@router.post("/clientes", status_code=201, summary="Crea un cliente con historia generada")
def crear_cliente(sol: dict):
    M = _main()
    try:
        datos_cli = M.NuevoCliente(**sol)
    except Exception as e:  # noqa: BLE001 — se devuelve el detalle de validación
        raise HTTPException(status_code=422, detail=str(e))
    M.crear_cliente(datos_cli)
    return _vista_cliente(_cliente(datos_cli.rut))


class CambioCliente(BaseModel):
    nombre: str | None = Field(None, min_length=2, max_length=80)
    clave: str | None = Field(None, min_length=4, max_length=20)


@router.patch("/clientes/{rut}", summary="Cambia nombre o clave de un cliente")
def editar_cliente(cambio: CambioCliente, rut: str = Path(...)):
    cliente = _cliente(rut)
    if cambio.nombre:
        cliente["nombre"] = cambio.nombre
    if cambio.clave:
        cliente["clave"] = cambio.clave
    # Los creados en vivo se reconstruyen desde sus parámetros al reiniciar:
    # el cambio tiene que quedar ahí para no perderse.
    if cliente["creado_en_vivo"] and cliente.get("parametros"):
        cliente["parametros"].update({k: v for k, v in cambio.model_dump().items() if v})
        C._guardar_creados()
    return _vista_cliente(cliente)


@router.delete("/clientes/{rut}", summary="Elimina un cliente (también los de base)")
def eliminar_cliente(rut: str = Path(...)):
    M = _main()
    cliente = _cliente(rut)
    rut_n = cliente["rut_normalizado"]
    for c in cliente["cuentas"]:
        C.DUENO_CUENTA.pop(c["accountId"], None)
    for c in cliente.get("creditos", []):
        C.DUENO_CREDITO.pop(c["loanID"], None)
    del C.CLIENTES[rut_n]
    if cliente["creado_en_vivo"]:
        C._guardar_creados()
    for t in [t for t, i in M.TOKENS.items() if i.get("rut") == rut_n]:
        del M.TOKENS[t]
    for r in [r for r, i in M.REFRESH.items() if i.get("rut") == rut_n]:
        del M.REFRESH[r]
    M._guardar_refresh()
    nota = None if cliente["creado_en_vivo"] else \
        "Es un cliente de base: vuelve al restablecer o al reiniciar la EFS."
    return {"eliminado": cliente["rut"], "nota": nota}


# ═════════════════════════ cuentas ═════════════════════════
def _cuenta(account_id: str) -> tuple[dict, dict]:
    rut = C.DUENO_CUENTA.get(account_id)
    cliente = C.CLIENTES.get(rut) if rut else None
    if cliente is None:
        raise HTTPException(status_code=404, detail="No existe la cuenta %s" % account_id)
    cuenta = next(c for c in cliente["cuentas"] if c["accountId"] == account_id)
    return cliente, cuenta


class CambioCuenta(BaseModel):
    status: str | None = Field(None, max_length=30)
    nickname: str | None = Field(None, max_length=60)


@router.patch("/cuentas/{accountID}", summary="Cambia estado o apodo de una cuenta")
def editar_cuenta(cambio: CambioCuenta, accountID: str = Path(...)):
    _, cuenta = _cuenta(accountID)
    for k, v in cambio.model_dump().items():
        if v is not None:
            cuenta[k] = v
    return cuenta


# ═════════════════════════ movimientos ═════════════════════════
def _vista_mov(cuenta: str, m: dict) -> dict:
    comercio = m.get("merchantDetails") or {}
    return {
        "transactionID": m["transactionID"],
        "cuenta": cuenta,
        "fecha": m["bookingDateTime"].isoformat(),
        "tipo": m["transactionsType"],
        "monto": m["amount"],
        "comercio": comercio.get("name"),
        "categoria": comercio.get("category"),
        "glosa": m.get("paymentPurposeCode"),
        "pendiente": bool(m.get("_pendiente")),
        "monto_final": m.get("_monto_final"),
        "futuro": m["bookingDateTime"] > _ahora(),
    }


@router.get("/cuentas/{accountID}/movimientos", summary="Movimientos de una cuenta, con internos")
def movimientos(accountID: str = Path(...),
                q: str | None = Query(None, description="Busca en comercio, glosa o ID"),
                limite: int = Query(200, ge=1, le=2000)):
    cliente, _ = _cuenta(accountID)
    movs = sorted(cliente["movimientos"].get(accountID, []),
                  key=lambda m: m["bookingDateTime"], reverse=True)
    vistas = [_vista_mov(accountID, m) for m in movs]
    if q:
        t = q.lower()
        vistas = [v for v in vistas if t in " ".join(
            str(v[k] or "") for k in ("transactionID", "comercio", "glosa", "categoria")).lower()]
    return {"total": len(vistas), "movimientos": vistas[:limite]}


class NuevoMovimiento(BaseModel):
    tipo: str = Field("Cargo", pattern="^(Cargo|Abono)$")
    monto: float = Field(..., gt=0)
    comercio: str | None = Field(None, max_length=80)
    categoria: str | None = Field(None, max_length=60)
    glosa: str | None = Field(None, max_length=120)
    fecha: datetime | None = Field(None, description="Por defecto, ahora")
    pendiente: bool = False
    monto_final: float | None = Field(None, gt=0, description="Monto al confirmar (pendientes)")


def _aplicar(m: dict, d: dict) -> None:
    """Escribe en un movimiento los campos enviados, con la forma del estándar."""
    if d.get("tipo"):
        m["transactionsType"] = d["tipo"]
    if d.get("monto"):
        m["amount"] = float(round(d["monto"]))
    if d.get("fecha"):
        f = d["fecha"]
        m["bookingDateTime"] = f if f.tzinfo else f.replace(tzinfo=timezone.utc)
    if "comercio" in d:
        if d["comercio"]:
            m["merchantDetails"] = {"name": d["comercio"], "category": d.get("categoria")}
        else:
            m.pop("merchantDetails", None)
    elif "categoria" in d and m.get("merchantDetails"):
        m["merchantDetails"]["category"] = d["categoria"]
    if "glosa" in d:
        if d["glosa"]:
            m["paymentPurposeCode"] = d["glosa"]
        else:
            m.pop("paymentPurposeCode", None)
    if "pendiente" in d:
        if d["pendiente"]:
            m["_pendiente"] = True
            m["_monto_final"] = float(round(d.get("monto_final") or m["amount"] * 1.15))
        else:
            m.pop("_pendiente", None)
            m.pop("_monto_final", None)


@router.post("/cuentas/{accountID}/movimientos", status_code=201,
             summary="Crea un cargo o abono con fecha, comercio y glosa libres")
def crear_movimiento(sol: NuevoMovimiento, accountID: str = Path(...)):
    cliente, _ = _cuenta(accountID)
    m = {
        "transactionID": "TXN-ADM-%s-%s" % (_ahora().strftime("%m%d%H%M%S"),
                                            secrets.token_hex(2).upper()),
        "bookingDateTime": _ahora(),
        "transactionsType": sol.tipo,
        "amount": float(round(sol.monto)),
        "currency": "CLP",
    }
    d = sol.model_dump()
    if not sol.comercio:
        d.pop("comercio")
    if not sol.glosa:
        d.pop("glosa")
    if not sol.comercio and not sol.glosa:
        d["glosa"] = "Transferencia" if sol.tipo == "Abono" else "Cargo"
    _aplicar(m, d)
    cliente["movimientos"].setdefault(accountID, []).append(m)
    return _vista_mov(accountID, m)


def _movimiento(txid: str):
    for cliente in C.CLIENTES.values():
        for cuenta, movs in cliente["movimientos"].items():
            for i, m in enumerate(movs):
                if m["transactionID"] == txid:
                    return cliente, cuenta, movs, i
    raise HTTPException(status_code=404, detail="No existe el movimiento %s" % txid)


class CambioMovimiento(BaseModel):
    tipo: str | None = Field(None, pattern="^(Cargo|Abono)$")
    monto: float | None = Field(None, gt=0)
    comercio: str | None = Field(None, max_length=80)
    categoria: str | None = Field(None, max_length=60)
    glosa: str | None = Field(None, max_length=120)
    fecha: datetime | None = None
    pendiente: bool | None = None
    monto_final: float | None = Field(None, gt=0)


@router.patch("/movimientos/{txid}", summary="Edita un movimiento (mismo transactionID)")
def editar_movimiento(cambio: CambioMovimiento, txid: str = Path(...)):
    _, cuenta, movs, i = _movimiento(txid)
    # exclude_unset: lo que no se mandó no se toca; "" sí borra comercio o glosa.
    _aplicar(movs[i], cambio.model_dump(exclude_unset=True))
    return _vista_mov(cuenta, movs[i])


@router.delete("/movimientos/{txid}", summary="Elimina un movimiento")
def eliminar_movimiento(txid: str = Path(...)):
    _, cuenta, movs, i = _movimiento(txid)
    movs.pop(i)
    return {"eliminado": txid, "cuenta": cuenta}


@router.post("/avanzar", summary="Confirma los pendientes (de un cliente o de todos)")
def avanzar(rut: str | None = Query(None)):
    return _main().avanzar_simulador(rut)


# ═════════════════════════ créditos ═════════════════════════
class NuevoCredito(BaseModel):
    producto: str = Field("Crédito de Consumo", max_length=60)
    tipo: str = Field("Consumo", max_length=40)
    monto: float = Field(3_000_000, gt=0)
    cuota: float = Field(120_000, gt=0)
    plazo: int = Field(24, ge=1, le=600)
    pagadas: int = Field(0, ge=0)
    tasa: float = Field(1.2, ge=0, le=100)


@router.post("/clientes/{rut}/creditos", status_code=201, summary="Agrega un crédito")
def crear_credito(sol: NuevoCredito, rut: str = Path(...)):
    _cliente(rut)
    return _main().agregar_credito(rut=rut, **sol.model_dump())["creado"]


def _credito(loan_id: str) -> tuple[dict, dict]:
    rut = C.DUENO_CREDITO.get(loan_id)
    cliente = C.CLIENTES.get(rut) if rut else None
    if cliente is None:
        raise HTTPException(status_code=404, detail="No existe el crédito %s" % loan_id)
    return cliente, next(c for c in cliente["creditos"] if c["loanID"] == loan_id)


class CambioCredito(BaseModel):
    pagar_cuotas: int | None = Field(None, ge=1, le=600)
    mora: bool | None = None
    cuota: float | None = Field(None, gt=0)
    restantes: int | None = Field(None, ge=0, le=600)


@router.patch("/creditos/{loanID}", summary="Paga cuotas, marca mora o ajusta un crédito")
def editar_credito(cambio: CambioCredito, loanID: str = Path(...)):
    _, cr = _credito(loanID)
    if cambio.cuota is not None:
        cr["monthlyInstallment"] = float(cambio.cuota)
    if cambio.restantes is not None:
        cr["remainingInstallments"] = min(cambio.restantes, cr["loanTermMonths"])
    if cambio.pagar_cuotas:
        cr["remainingInstallments"] = max(0, cr["remainingInstallments"] - cambio.pagar_cuotas)
    if cambio.mora is not None:
        cr["arrears"] = cambio.mora
    cr["currentBalance"] = float(cr["remainingInstallments"] * cr["monthlyInstallment"])
    cr["status"] = "Vigente" if cr["remainingInstallments"] else "Pagado"
    return cr


@router.delete("/creditos/{loanID}", summary="Elimina un crédito")
def eliminar_credito(loanID: str = Path(...)):
    cliente, cr = _credito(loanID)
    cliente["creditos"].remove(cr)
    C.DUENO_CREDITO.pop(loanID, None)
    return {"eliminado": loanID}


# ═════════════════════════ permisos y tokens ═════════════════════════
@router.get("/permisos", summary="Consentimientos, tokens de acceso y de renovación")
def permisos():
    M = _main()
    ahora = _ahora()

    def nombre(rut_n):
        c = C.CLIENTES.get(rut_n or "")
        return c["nombre"] if c else None

    # Los consentimientos viven en memoria; los refresh tokens en archivo. Tras
    # un reinicio puede haber permisos (refresh) cuyo consentimiento ya no está
    # en memoria: se listan igual, agrupados por consentId.
    por_id: dict[str, dict] = {}
    for cid, c in M.CONSENTIMIENTOS.items():
        rut_n = C.normalizar_rut(c["rut"]) if c.get("rut") else None
        por_id[cid] = {"consentId": cid, "status": c["status"], "permisos": c["permissions"],
                       "rut": rut_n, "cliente": nombre(rut_n),
                       "creado": c["creationDateTime"].isoformat(),
                       "expira": c["expirationDateTime"].isoformat(),
                       "tokens_acceso": 0, "refresh_tokens": 0}
    for i in M.REFRESH.values():
        p = por_id.setdefault(i["consentId"], {
            "consentId": i["consentId"], "status": "Authorised (restaurado)",
            "permisos": i["permisos"], "rut": i["rut"], "cliente": nombre(i["rut"]),
            "creado": None, "expira": i["expira"].isoformat(),
            "tokens_acceso": 0, "refresh_tokens": 0})
        p["refresh_tokens"] += 1
    for i in M.TOKENS.values():
        if i["consentId"] in por_id and i["expira"] > ahora:
            por_id[i["consentId"]]["tokens_acceso"] += 1

    return {
        "consentimientos": sorted(por_id.values(), key=lambda p: p["creado"] or "", reverse=True),
        "tokens_acceso": [{"token": _mascara(t), "consentId": i["consentId"], "rut": i["rut"],
                           "cliente": nombre(i["rut"]), "expira": i["expira"].isoformat(),
                           "vigente": i["expira"] > ahora}
                          for t, i in M.TOKENS.items()],
        "tokens_participante": [{"token": _mascara(t), "client_id": i.get("client_id"),
                                 "expira": i["expira"].isoformat(), "vigente": i["expira"] > ahora}
                                for t, i in M.PARTICIPANTES.items()],
    }


@router.delete("/permisos/{consentId:path}", summary="Revoca un consentimiento")
def revocar(consentId: str):
    return _main().revocar_consentimiento(consentId)


@router.post("/revocar-todo", summary="Revoca todos los permisos y tokens")
def revocar_todo(participantes: bool = Query(True, description="También los tokens de participante")):
    M = _main()
    for c in M.CONSENTIMIENTOS.values():
        if c["status"] != "Revoked":
            c["status"] = "Revoked"
    n = {"tokens_acceso": len(M.TOKENS), "refresh_tokens": len(M.REFRESH)}
    M.TOKENS.clear()
    M.REFRESH.clear()
    M.SOLICITUDES_PAR.clear()
    M.CODIGOS.clear()
    if participantes:
        n["tokens_participante"] = len(M.PARTICIPANTES)
        M.PARTICIPANTES.clear()
    M._guardar_refresh()
    return {"revocados": n}


# ═════════════════════════ restablecer ═════════════════════════
@router.post("/restablecer", summary="Vuelve a los datos de base sin reiniciar")
def restablecer(borrar_creados: bool = Query(False, description="Borra también los clientes creados"),
                revocar_permisos: bool = Query(False, description="Revoca además todos los permisos")):
    """
    Regenera clientes, cuentas, movimientos y créditos como al arrancar: se
    pierden las compras en vivo, los pendientes, los créditos agregados y las
    ediciones. Los clientes creados se regeneran desde sus parámetros (o se
    borran, si se pide). Los permisos se conservan salvo que se pida lo contrario.
    """
    importlib.reload(datos)  # datos.MOVIMIENTOS se modifica en vivo: vuelve al JSON
    C.CLIENTES.clear()
    C.DUENO_CUENTA.clear()
    C.DUENO_CREDITO.clear()
    C._cargar_base()
    if borrar_creados:
        C._guardar_creados()  # ya no hay creados en memoria: deja el archivo vacío
    else:
        C._cargar_creados()
    FALLAS.update(modo="ninguna", afectadas=0)
    if revocar_permisos:
        revocar_todo(participantes=True)
    return estado()


# ═════════════════════════ página ═════════════════════════
pagina = APIRouter()


@pagina.get("/admin", response_class=HTMLResponse, tags=["Administración"],
            summary="Consola de administración de la EFS")
def pagina_admin():
    from app.admin_pagina import ADMIN_HTML
    return HTMLResponse(ADMIN_HTML)
