# -*- coding: utf-8 -*-
"""
Cliente del estándar SFA (API de Cuentas).

Esta es la capa que habla con el proveedor. Hoy apunta al simulador; para un
banco real solo cambian dos cosas, ambas aisladas aquí:

  1. La URL base  → viene de config.SFA_BASE_URL.
  2. La autenticación → hoy no hay (el simulador es abierto); mañana se agregan
     mTLS (certificado de cliente) y el token OAuth en el método _headers().
     El resto del código —normalización y base de datos— no se entera.

El estándar envuelve TODA respuesta en { "data": ..., "links": ..., "meta": ... }
y pagina con page/pageSize. Este cliente esconde esos detalles: quien lo usa
pide "las cuentas" o "los movimientos" y recibe listas limpias.
"""
from __future__ import annotations

import httpx


class ClienteSFA:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self._http = httpx.Client(base_url=self.base_url, timeout=timeout)

    # -- autenticación: el punto de extensión para el banco real --------------
    def _headers(self) -> dict:
        """
        Hoy solo un identificador de interacción que pide FAPI. Para un banco
        real, aquí se agrega:  Authorization: Bearer <token OAuth>.
        El certificado de cliente (mTLS) se configuraría en el httpx.Client.
        """
        return {"x-fapi-interaction-id": "velvet-ingesta"}

    def _get(self, ruta: str, params: dict | None = None) -> dict:
        r = self._http.get(ruta, params=params, headers=self._headers())
        r.raise_for_status()
        return r.json()

    # -- endpoints del estándar ----------------------------------------------
    def listar_cuentas(self) -> list[dict]:
        cuerpo = self._get("/accounts")
        return cuerpo["data"]["accounts"]

    def obtener_saldo(self, account_id: str) -> dict | None:
        cuerpo = self._get("/accounts/%s/balance" % account_id)
        return cuerpo["data"].get("balance")

    def obtener_movimientos(self, account_id: str,
                            desde: str | None = None,
                            page_size: int = 100) -> list[dict]:
        """
        Trae TODOS los movimientos de la cuenta, recorriendo las páginas que
        haga falta. `desde` (fecha ISO 'YYYY-MM-DD') activa la sincronización
        incremental: pedir solo lo nuevo desde la última vez.
        """
        movimientos: list[dict] = []
        page = 1
        while True:
            params = {"page": page, "pageSize": page_size}
            if desde:
                params["fromDate"] = desde
            cuerpo = self._get("/accounts/%s/transactions" % account_id, params)
            movimientos.extend(cuerpo["data"]["transactions"])
            total_paginas = cuerpo.get("meta", {}).get("totalPages", 1)
            if page >= total_paginas:
                break
            page += 1
        return movimientos

    def close(self):
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
