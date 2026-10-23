# -*- coding: utf-8 -*-
"""
Créditos del usuario (API de Operaciones de Crédito del SFA).

  GET /api/creditos  -> los créditos vigentes, con lo que se paga al mes

Llegan por el estándar, no se cargan a mano: es la misma tubería que los
movimientos, con otra familia de endpoints y su propio permiso en el
consentimiento.

**Lo que no hay, y por qué.** No se muestra CAE ni tabla de amortización. El
estándar no los entrega —`amortizationScheduleLink` es solo una URL al
calendario del proveedor— y calcularlos exigiría conocer comisiones, seguros y
gastos que tampoco vienen. Un CAE estimado con datos incompletos se vería
igual de cierto que uno correcto y el usuario tomaría decisiones de dinero con
él. Se muestra lo que el banco afirma, y se dice de dónde sale.
"""
from fastapi import APIRouter, Depends
from psycopg.rows import dict_row

import psycopg

from . import config
from .sesion_actual import usuario_actual

router = APIRouter(prefix="/api/creditos", tags=["Créditos"])


def _conectar():
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


@router.get("", summary="Créditos del usuario autenticado")
def listar(usuario_id: str = Depends(usuario_actual)):
    with _conectar() as conn:
        filas = conn.execute(
            """
            SELECT c.id, c.id_externo, c.producto, c.tipo, c.moneda, c.estado,
                   c.monto_original, c.cuota_mensual, c.plazo_meses,
                   c.cuotas_restantes, c.saldo_actual, c.tasa_interes,
                   c.tipo_tasa, c.proposito, c.dia_de_pago, c.en_mora,
                   c.calendario_url, c.actualizado_at,
                   inst.nombre AS institucion
            FROM credito c
            JOIN conexion cx      ON cx.id = c.conexion_id
            JOIN institucion inst ON inst.id = cx.institucion_id
            WHERE c.usuario_id = %s
            ORDER BY c.saldo_actual DESC NULLS LAST
            """,
            (usuario_id,),
        ).fetchall()

    def plata(v):
        return float(v) if v is not None else None

    creditos = [{
        "id": str(f["id"]),
        "idExterno": f["id_externo"],
        "institucion": f["institucion"],
        "producto": f["producto"],
        "tipo": f["tipo"],
        "moneda": f["moneda"],
        "estado": f["estado"],
        "montoOriginal": plata(f["monto_original"]),
        "cuotaMensual": plata(f["cuota_mensual"]),
        "plazoMeses": f["plazo_meses"],
        "cuotasRestantes": f["cuotas_restantes"],
        "saldoActual": plata(f["saldo_actual"]),
        "tasaInteres": plata(f["tasa_interes"]),
        "tipoTasa": f["tipo_tasa"],
        "proposito": f["proposito"],
        "diaDePago": f["dia_de_pago"],
        "enMora": f["en_mora"],
        "calendarioUrl": f["calendario_url"],
        "actualizadoEn": f["actualizado_at"].isoformat() if f["actualizado_at"] else None,
    } for f in filas]

    vigentes = [c for c in creditos if (c["cuotasRestantes"] or 0) > 0]
    return {
        "creditos": creditos,
        # Lo que se va en cuotas cada mes: la cifra que la persona necesita
        # para saber de cuánto dispone realmente.
        "cuotaTotalMensual": round(sum(c["cuotaMensual"] or 0 for c in vigentes)),
        "saldoTotal": round(sum(c["saldoActual"] or 0 for c in vigentes)),
        "vigentes": len(vigentes),
    }
