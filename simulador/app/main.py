# -*- coding: utf-8 -*-
"""
Simulador de Entidad Financiera — Sistema de Finanzas Abiertas (Chile)

Finge ser un banco participante del SFA. Implementa la API de Cuentas conforme
al OpenAPI publicado por la CMF (spec/Accounts.yaml).

Estado: servidor de recursos con datos de prueba. Todavía sin PAR, sin mTLS y
sin firma JWS — esas capas se agregan después, sobre algo que ya funciona.

Levantar con:  uvicorn app.main:app --reload --port 8001
"""
from datetime import date, datetime
from urllib.parse import urlencode

from fastapi import FastAPI, HTTPException, Query, Path, Header
from fastapi.responses import JSONResponse

from app.datos import CUENTAS, SALDOS, MOVIMIENTOS

# El backend de Velvet Wallet corre en el 8000. El simulador va en el 8001
# para que se puedan levantar los dos a la vez.
BASE = "http://localhost:8001/accounts/v1"

app = FastAPI(
    title="Simulador de Entidad Financiera — SFA Chile",
    version="1.0.0",
    description=(
        "Banco simulado conforme a la API de Cuentas del Sistema de Finanzas "
        "Abiertas. Construido a partir del OpenAPI publicado por la CMF."
    ),
    root_path="",
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

    '_pendiente' y '_monto_final' son información interna del simulador: un
    banco real sabe que una transacción está pendiente, pero esta API no tiene
    campo para decirlo. Si los enviáramos, dejaríamos de ser conformes.
    """
    return {k: v for k, v in movimiento.items() if not k.startswith("_")}


def cuenta_o_404(account_id):
    c = next((c for c in CUENTAS if c["accountId"] == account_id), None)
    if c is None:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return c


# ───────────────────────── endpoints ─────────────────────────
@app.get("/health", tags=["Operación"], summary="Comprobación de vida")
def health():
    return {"ok": True, "servicio": "simulador-sfa", "cuentas": len(CUENTAS)}


@app.get("/accounts/v1/accounts", tags=["Cuentas"],
         summary="Listado de cuentas del cliente")
def listar_cuentas(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    x_fapi_interaction_id: str | None = Header(None, alias="x-fapi-interaction-id"),
):
    datos, links, meta = paginar(CUENTAS, page, pageSize, "/accounts")
    return {"data": {"accounts": datos}, "links": links, "meta": meta}


@app.get("/accounts/v1/accounts/{accountID}", tags=["Cuentas"],
         summary="Detalle de una cuenta")
def detalle_cuenta(accountID: str = Path(...)):
    c = cuenta_o_404(accountID)
    _, links, meta = paginar([c], 1, 1, "/accounts/%s" % accountID)
    return {"data": {"account": c}, "links": links, "meta": meta}


@app.get("/accounts/v1/accounts/{accountID}/balance", tags=["Cuentas"],
         summary="Saldos de la cuenta")
def saldo_cuenta(accountID: str = Path(...)):
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
# se declaran para que el simulador sea completo, devolviendo vacío.
@app.get("/accounts/v1/accounts/{accountID}/overdraft", tags=["Cuentas"],
         summary="Movimientos de sobregiro")
def sobregiro(accountID: str = Path(...)):
    cuenta_o_404(accountID)
    _, links, meta = paginar([], 1, 1, "/accounts/%s/overdraft" % accountID)
    return {"data": {"overdraft": []}, "links": links, "meta": meta}


@app.get("/accounts/v1/accounts/{accountID}/current-overdraft-limit",
         tags=["Cuentas"], summary="Límite de sobregiro vigente")
def limite_sobregiro(accountID: str = Path(...)):
    cuenta_o_404(accountID)
    _, links, meta = paginar([], 1, 1,
                             "/accounts/%s/current-overdraft-limit" % accountID)
    return {"data": {"currentOverdraftLimit": []}, "links": links, "meta": meta}


# ═══════════════════════════════════════════════════════════════════
#  Control del simulador
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
