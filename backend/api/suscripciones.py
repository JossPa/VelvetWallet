# -*- coding: utf-8 -*-
"""
Suscripciones y gastos recurrentes detectados (RF-20…RF-22).

  GET   /api/suscripciones              -> las detectadas, con su estado
  PATCH /api/suscripciones/{id}         -> confirmar o descartar

El detector propone, la persona dispone. Una suscripción nace en estado
`detectada` y solo cambia cuando el usuario la confirma o la descarta: el
algoritmo acierta casi siempre pero no siempre, y marcar como gasto fijo algo
que no lo es desordena el presupuesto de alguien. Esa decisión suya se respeta
en las sincronizaciones siguientes (ver `guardar_suscripciones`).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row

import psycopg

from . import config
from .sesion_actual import usuario_actual

router = APIRouter(prefix="/api/suscripciones", tags=["Suscripciones"])

# Cuántas veces al mes ocurre cada periodicidad, para llevar todo a una base
# comparable. Sin esto, una suscripción semanal de $10.000 parecería más barata
# que una mensual de $20.000.
AL_MES = {
    "semanal": 30 / 7,
    "quincenal": 30 / 15,
    "mensual": 1.0,
    "bimestral": 0.5,
    "trimestral": 1 / 3,
    "anual": 1 / 12,
}


class Decision(BaseModel):
    """`confirmada` o `descartada`. No se permite volver a `detectada`."""
    estado: str


def _conectar():
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


@router.get("", summary="Gastos recurrentes detectados")
def listar(usuario_id: str = Depends(usuario_actual)):
    with _conectar() as conn:
        filas = conn.execute(
            """
            SELECT s.id, s.nombre, s.periodicidad, s.monto_esperado,
                   s.proxima_fecha_estimada, s.estado,
                   count(t.id)  AS cobros,
                   max(t.fecha) AS ultimo_cobro
            FROM suscripcion s
            LEFT JOIN transaccion t ON t.suscripcion_id = s.id
            WHERE s.usuario_id = %s
            GROUP BY s.id
            ORDER BY s.monto_esperado DESC NULLS LAST
            """,
            (usuario_id,),
        ).fetchall()

    suscripciones = [{
        "id": str(f["id"]),
        "nombre": f["nombre"],
        "periodicidad": f["periodicidad"],
        "montoEsperado": float(f["monto_esperado"]) if f["monto_esperado"] is not None else None,
        "proximaFecha": f["proxima_fecha_estimada"].isoformat() if f["proxima_fecha_estimada"] else None,
        "estado": f["estado"],
        "cobros": f["cobros"],
        "ultimoCobro": f["ultimo_cobro"].isoformat() if f["ultimo_cobro"] else None,
    } for f in filas]

    # El total cuenta lo detectado y lo confirmado, no lo descartado: si la
    # persona dijo que algo no es un gasto fijo, no puede seguir sumando.
    comprometido = round(sum(
        (s["montoEsperado"] or 0) * AL_MES.get(s["periodicidad"] or "", 0)
        for s in suscripciones if s["estado"] != "descartada"
    ))

    return {
        "suscripciones": suscripciones,
        "comprometidoAlMes": comprometido,
        "porRevisar": sum(1 for s in suscripciones if s["estado"] == "detectada"),
    }


@router.patch("/{suscripcion_id}", summary="Confirmar o descartar una suscripción")
def decidir(suscripcion_id: str, decision: Decision,
            usuario_id: str = Depends(usuario_actual)):
    if decision.estado not in ("confirmada", "descartada"):
        raise HTTPException(status_code=422, detail="Estado inválido.")

    with _conectar() as conn:
        # El filtro por usuario va en el WHERE, no en una comprobación aparte:
        # así no existe forma de tocar la suscripción de otra persona.
        fila = conn.execute(
            "UPDATE suscripcion SET estado = %s WHERE id::text = %s AND usuario_id = %s "
            "RETURNING id, nombre, estado",
            (decision.estado, suscripcion_id, usuario_id),
        ).fetchone()
        if fila is None:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada.")

        # Descartarla deja de tratar sus movimientos como gasto fijo, pero no
        # los borra ni los oculta: siguen siendo gastos del mes.
        if decision.estado == "descartada":
            conn.execute(
                "UPDATE transaccion SET es_recurrente = false WHERE suscripcion_id = %s",
                (fila["id"],),
            )
        conn.commit()

    return {"id": str(fila["id"]), "nombre": fila["nombre"], "estado": fila["estado"]}
