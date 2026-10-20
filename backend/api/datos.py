# -*- coding: utf-8 -*-
"""
Endpoints de datos del usuario: movimientos, cuentas y un resumen.

Todos exigen sesión (dependen de `usuario_actual`) y TODAS las consultas filtran
por el usuario del token. Ese filtro (WHERE usuario_id = <token>) es lo que
garantiza que cada usuario vea únicamente su propia información.

  GET /api/movimientos  -> lista de movimientos del usuario
  GET /api/cuentas       -> cuentas del usuario
  GET /api/resumen       -> totales (ingresos, gastos, saldo)
"""
from fastapi import APIRouter, Depends, Query
from psycopg.rows import dict_row

from . import config, db
from .sesion_actual import usuario_actual

import psycopg

router = APIRouter(prefix="/api", tags=["Datos del usuario"])


def _conectar_dict():
    """Conexión que devuelve filas como diccionarios (más cómodo para armar JSON)."""
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


# Equivalencia entre la taxonomía del banco y la nuestra. Es la **primera capa
# de la cascada** del clasificador (E2): lo que la institución ya clasificó se
# resuelve sin modelo. Cada proveedor usa su propia taxonomía y no hay
# equivalencia común, así que esta tabla es parte del trabajo de normalizar.
#
# PENDIENTE: cuando exista el clasificador entrenado, él llena `categoria_id` y
# esta tabla solo cubre lo que llega ya categorizado por el banco.
_CATEGORIA_PROPIA = {
    "Alimentos": "Supermercado",
    "Restaurantes": "Delivery",
    "Entretenimiento": "Entretención",
    "Servicios": "Servicios",
    "Vivienda": "Vivienda",
    "Transporte": "Transporte",
    "Vestuario": "Vestuario",
    "Salud": "Salud",
    "Educacion": "Educación",
    "Educación": "Educación",
}


def _movimiento(r: dict) -> dict:
    """Pasa una fila de la consulta a la forma que espera la app (camelCase)."""
    categoria_banco = r.get("categoria_origen")

    # Primero lo que diga el clasificador; si todavía no clasificó, lo que
    # mandó el banco traducido a nuestra taxonomía. Si no hay ninguna de las
    # dos, queda sin categoría: el sistema se abstiene en vez de inventar
    # (RF-17 / RNF-33) y el movimiento aparece en la bandeja Por revisar.
    categoria = r["categoria"] or _CATEGORIA_PROPIA.get(categoria_banco or "")
    tiene_categoria = categoria is not None

    return {
        "id": str(r["id"]),
        "cuentaId": r["cuenta_externa"],
        "institucion": r["institucion"],
        "fecha": (r["fecha"].isoformat() + "T12:00:00-03:00") if r["fecha"] else None,
        "monto": float(r["monto"]),
        "moneda": r["moneda"],
        "comercio": r["glosa_normalizada"] or r["glosa_original"],
        "glosaOriginal": r["glosa_original"],
        "categoria": categoria,
        "categoriaBanco": categoria_banco,
        "estadoCategoria": "automatica" if tiene_categoria else "sin_categoria",
        "esRecurrente": r["es_recurrente"],
        "excluido": r["estado"] == "excluido",
        "origen": "sfa" if r["participante_sfa"] else "manual",
        "recibidoEn": r["created_at"].isoformat() if r["created_at"] else None,
        "payloadCrudoRef": r["payload_crudo_ref"],
        "correcciones": [],
    }


@router.get("/movimientos", summary="Movimientos del usuario autenticado")
def listar_movimientos(
    usuario_id: str = Depends(usuario_actual),
    limite: int = Query(100, ge=1, le=500),
    desplazamiento: int = Query(0, ge=0),
):
    with _conectar_dict() as conn:
        filas = conn.execute(
            """
            SELECT t.id, t.monto, t.moneda, t.fecha, t.glosa_original,
                   t.glosa_normalizada, t.estado, t.es_recurrente,
                   t.payload_crudo_ref, t.created_at, t.categoria_origen,
                   c.id_externo        AS cuenta_externa,
                   cat.nombre          AS categoria,
                   inst.nombre         AS institucion,
                   inst.participante_sfa
            FROM transaccion t
            JOIN cuenta c         ON c.id  = t.cuenta_id
            JOIN conexion cx      ON cx.id = c.conexion_id
            JOIN institucion inst ON inst.id = cx.institucion_id
            LEFT JOIN categoria cat ON cat.id = t.categoria_id
            WHERE c.usuario_id = %s
            ORDER BY t.fecha DESC, t.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (usuario_id, limite, desplazamiento),
        ).fetchall()

    return {"movimientos": [_movimiento(r) for r in filas], "total": len(filas)}


@router.get("/cuentas", summary="Cuentas del usuario autenticado")
def listar_cuentas(usuario_id: str = Depends(usuario_actual)):
    with _conectar_dict() as conn:
        filas = conn.execute(
            """
            SELECT c.id, c.id_externo, c.tipo, c.numero_enmascarado,
                   c.moneda, c.saldo, c.actualizado_at,
                   inst.nombre AS institucion
            FROM cuenta c
            JOIN conexion cx      ON cx.id = c.conexion_id
            JOIN institucion inst ON inst.id = cx.institucion_id
            WHERE c.usuario_id = %s
            ORDER BY inst.nombre, c.id_externo
            """,
            (usuario_id,),
        ).fetchall()

    cuentas = [
        {
            "id": str(r["id"]),
            "idExterno": r["id_externo"],
            "institucion": r["institucion"],
            "tipo": r["tipo"],
            "numeroEnmascarado": r["numero_enmascarado"],
            "moneda": r["moneda"],
            "saldo": float(r["saldo"]) if r["saldo"] is not None else None,
            "actualizadoEn": r["actualizado_at"].isoformat() if r["actualizado_at"] else None,
        }
        for r in filas
    ]
    return {"cuentas": cuentas, "total": len(cuentas)}


@router.get("/resumen", summary="Totales del usuario autenticado")
def resumen(usuario_id: str = Depends(usuario_actual)):
    with _conectar_dict() as conn:
        tot = conn.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN t.monto > 0 THEN t.monto ELSE 0 END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN t.monto < 0 THEN -t.monto ELSE 0 END), 0) AS gastos,
              COUNT(*) AS movimientos
            FROM transaccion t
            JOIN cuenta c ON c.id = t.cuenta_id
            WHERE c.usuario_id = %s AND t.estado <> 'excluido'
            """,
            (usuario_id,),
        ).fetchone()

        saldo = conn.execute(
            "SELECT COALESCE(SUM(saldo), 0) AS saldo_total FROM cuenta WHERE usuario_id = %s",
            (usuario_id,),
        ).fetchone()

    return {
        "ingresos": float(tot["ingresos"]),
        "gastos": float(tot["gastos"]),
        "balance": float(tot["ingresos"]) - float(tot["gastos"]),
        "saldoTotal": float(saldo["saldo_total"]),
        "movimientos": tot["movimientos"],
    }
