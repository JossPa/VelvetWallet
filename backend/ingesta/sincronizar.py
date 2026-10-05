# -*- coding: utf-8 -*-
"""
Orquestador de la ingesta:  proveedor SFA → Mongo (crudo) → Postgres (canónico).

Correr desde la carpeta backend/ con:

    python -m ingesta.sincronizar

Requisitos: el simulador levantado (uvicorn, puerto 8001) y las bases arriba
(docker compose up -d en BD/).
"""
from __future__ import annotations

from . import config
from .bootstrap import asegurar_identidad
from .cliente_sfa import ClienteSFA
from .normalizador import cuenta_canonica, transaccion_canonica
from .repositorio import Repositorio


def sincronizar(desde: str | None = None) -> dict:
    """
    Trae todo lo del proveedor y lo deja en las dos bases.
    `desde` ('YYYY-MM-DD') limita a lo nuevo desde esa fecha (sync incremental).
    """
    repo = Repositorio()
    cuentas_vistas = 0
    insertadas = 0
    actualizadas = 0

    try:
        # 1. Identidad mínima (usuario/institución/conexión), idempotente.
        usuario_id, conexion_id = asegurar_identidad(repo.conn)

        with ClienteSFA(config.SFA_BASE_URL) as banco:
            # 2. Por cada cuenta del banco...
            for cuenta in banco.listar_cuentas():
                account_id = cuenta["accountId"]
                saldo = banco.obtener_saldo(account_id)

                # 2a. Upsert de la cuenta (clave: conexion_id + accountId).
                cuenta_id = repo.upsert_cuenta(
                    conexion_id, usuario_id, cuenta_canonica(cuenta, saldo)
                )
                cuentas_vistas += 1

                # 2b. Cada movimiento: crudo a Mongo, normalizado a Postgres.
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

        # 3. Marcar la sincronización y confirmar todo de una.
        repo.marcar_sincronizacion(conexion_id)
        repo.commit()
    finally:
        repo.close()

    return {
        "cuentas": cuentas_vistas,
        "insertadas": insertadas,
        "actualizadas": actualizadas,
    }


if __name__ == "__main__":
    resumen = sincronizar()
    print("Sincronización lista:")
    print("  Cuentas procesadas : %d" % resumen["cuentas"])
    print("  Movimientos nuevos : %d" % resumen["insertadas"])
    print("  Movimientos actualizados: %d" % resumen["actualizadas"])
