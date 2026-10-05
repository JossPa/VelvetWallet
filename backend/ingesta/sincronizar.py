# -*- coding: utf-8 -*-
"""
Orquestador de la ingesta:
    token participante → consentimiento (RAR) → proveedor SFA →
    Mongo (crudo) → Postgres (canónico).

Correr desde la carpeta backend/ con:

    python -m ingesta.sincronizar

Requisitos: la EFS (simulador) levantada (uvicorn, puerto 8001) y las bases
arriba (Postgres y Mongo; hoy en la nube: Neon y Atlas).

El flujo de seguridad va primero, alineado con la guía ATENA de la CMF:
  1. token de participante (Client Credentials) — prueba que somos Velvet (PSBI),
  2. consentimiento con alcance RAR — qué datos se piden,
  3. autorización del usuario — se emite el token de acceso,
  4. recién ahí se leen los datos. Sin ese permiso, la EFS no entrega nada.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from . import config
from .bootstrap import asegurar_identidad
from .cliente_sfa import ClienteSFA
from .normalizador import cuenta_canonica, transaccion_canonica
from .repositorio import Repositorio

# Qué datos se piden al banco (RAR — Rich Authorization Request). Es el alcance
# que el usuario autoriza: leer sus cuentas, saldos y movimientos.
PERMISOS = ["ReadAccountsBasic", "ReadBalances", "ReadTransactionsDetail"]


def sincronizar(desde: str | None = None) -> dict:
    """
    Trae todo lo del proveedor y lo deja en las dos bases.
    `desde` ('YYYY-MM-DD') limita a lo nuevo desde esa fecha (sync incremental).
    """
    repo = Repositorio()
    cuentas_vistas = 0
    insertadas = 0
    actualizadas = 0
    consent_id = None

    try:
        # 1. Identidad mínima (usuario/institución/conexión), idempotente.
        usuario_id, conexion_id = asegurar_identidad(repo.conn)

        with ClienteSFA(config.SFA_BASE_URL) as banco:
            # 2. Seguridad: token de participante + consentimiento + autorización.
            #    A partir de aquí el cliente manda el token de acceso en cada llamada.
            consent_id, info_token = banco.obtener_acceso(
                config.SFA_CLIENT_ID, config.SFA_CLIENT_SECRET, PERMISOS
            )

            # 2a. Dejar registrado el consentimiento vigente en la base.
            expira = datetime.now(timezone.utc) + timedelta(
                seconds=info_token.get("expires_in", 0)
            )
            repo.registrar_consentimiento(
                conexion_id,
                {
                    "permisos": PERMISOS,
                    "consentId": consent_id,
                    "proveedor": config.INSTITUCION_NOMBRE,
                },
                expira,
            )

            # 3. Por cada cuenta del banco...
            for cuenta in banco.listar_cuentas():
                account_id = cuenta["accountId"]
                saldo = banco.obtener_saldo(account_id)

                # 3a. Upsert de la cuenta (clave: conexion_id + accountId).
                cuenta_id = repo.upsert_cuenta(
                    conexion_id, usuario_id, cuenta_canonica(cuenta, saldo)
                )
                cuentas_vistas += 1

                # 3b. Cada movimiento: crudo a Mongo, normalizado a Postgres.
                endpoint = "/accounts/%s/transactions" % account_id
                for mov in banco.obtener_movimientos(account_id, desde=desde):
                    ref = repo.guardar_crudo(conexion_id, endpoint, mov)
                    es_nueva = repo.upsert_transaccion(
                        cuenta_id, ref, transaccion_canonica(account_id, mov)
                    )
                    if es_nueva:
                        insertadas += 1
                    else:
                        actualizadas += 1

        # 4. Marcar la sincronización y confirmar todo de una.
        repo.marcar_sincronizacion(conexion_id)
        repo.commit()
    finally:
        repo.close()

    return {
        "consentimiento": consent_id,
        "cuentas": cuentas_vistas,
        "insertadas": insertadas,
        "actualizadas": actualizadas,
    }


if __name__ == "__main__":
    resumen = sincronizar()
    print("Sincronización lista:")
    print("  Consentimiento     : %s" % resumen["consentimiento"])
    print("  Cuentas procesadas : %d" % resumen["cuentas"])
    print("  Movimientos nuevos : %d" % resumen["insertadas"])
    print("  Movimientos actualizados: %d" % resumen["actualizadas"])
