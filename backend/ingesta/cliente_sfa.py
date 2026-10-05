# -*- coding: utf-8 -*-
"""
Cliente del estándar SFA (API de Cuentas).

Esta es la capa que habla con el proveedor (hoy, la Entidad Financiera Simulada;
mañana, un banco real). Para un banco real solo cambian dos cosas, ambas
aisladas aquí:

  1. La URL base  → viene de config.SFA_BASE_URL.
  2. La autenticación → se obtiene un token de participante (Client Credentials)
     y luego un token de acceso vía consentimiento (RAR), y se manda como
     'Authorization: Bearer'. Para un banco real se agrega además mTLS
     (certificado de cliente) en el httpx.Client. El resto del código
     —normalización y base de datos— no se entera.

Flujo de seguridad (alineado con la guía ATENA de la CMF):
    token participante (Client Credentials) → consentimiento (RAR) →
    autorización del usuario → token de acceso → lectura de datos.

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
        self._token: str | None = None  # token vigente (participante, y luego de acceso)

    # -- autenticación: el punto de extensión para el banco real --------------
    def _headers(self) -> dict:
        """
        Identificador de interacción que pide FAPI, y —si ya hay token— el
        Authorization Bearer. Para un banco real, el certificado de cliente
        (mTLS) se configuraría en el httpx.Client.
        """
        h = {"x-fapi-interaction-id": "velvet-ingesta"}
        if self._token:
            h["Authorization"] = "Bearer %s" % self._token
        return h

    def _get(self, ruta: str, params: dict | None = None) -> dict:
        r = self._http.get(ruta, params=params, headers=self._headers())
        r.raise_for_status()
        return r.json()

    # -- paso 0: token del participante (Client Credentials) ------------------
    # En ATENA es el "Crear Token del Participante": prueba que quien llama es un
    # participante habilitado del SFA, antes de poder siquiera pedir un consentimiento.
    def obtener_token_participante(self, client_id: str, client_secret: str) -> dict:
        """Autentica al participante y deja su token puesto para las siguientes llamadas."""
        r = self._http.post("/token", json={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        })
        r.raise_for_status()
        datos = r.json()
        self._token = datos["access_token"]
        return datos

    # -- consentimiento: pedir permiso y obtener el token de acceso -----------
    # Esto es lo que, en el SFA real, hace que el usuario autorice el acceso en
    # su banco antes de que se pueda leer un solo dato. Aquí se hace en dos
    # pasos (crear + autorizar); en producción el segundo paso es el login y la
    # aprobación del usuario en el sitio del banco (flujo de autorización / PAR).
    def solicitar_consentimiento(self, permisos: list[str]) -> str:
        """Pide el consentimiento (usa el token de participante) y devuelve el consentId."""
        r = self._http.post("/consents", json={"permissions": permisos},
                             headers=self._headers())
        r.raise_for_status()
        return r.json()["data"]["consentId"]

    def autorizar_consentimiento(self, consent_id: str) -> dict:
        """
        Autoriza el consentimiento (el usuario aprueba) y recibe el token de
        acceso. Deja ese token puesto en el cliente para leer datos.
        """
        r = self._http.post("/consents/%s/authorise" % consent_id,
                             headers=self._headers())
        r.raise_for_status()
        datos = r.json()
        self._token = datos["access_token"]
        return datos

    def obtener_acceso(self, client_id: str, client_secret: str,
                       permisos: list[str]) -> tuple[str, dict]:
        """
        Flujo completo de seguridad, en orden:
          1. token de participante (Client Credentials),
          2. solicitar consentimiento (RAR),
          3. autorizar y quedar con el token de acceso cargado.
        Devuelve (consentId, datos_del_token_de_acceso).
        """
        self.obtener_token_participante(client_id, client_secret)
        consent_id = self.solicitar_consentimiento(permisos)
        datos_token = self.autorizar_consentimiento(consent_id)
        return consent_id, datos_token

    # -- endpoints del estándar (requieren token de acceso) -------------------
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
