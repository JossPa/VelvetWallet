# -*- coding: utf-8 -*-
"""
Excedente mensual y flujo de caja hasta el día de pago (RF-23, RF-25).

  GET /api/flujo -> { excedente, flujo }

Hasta ahora el panel mostraba "disponible = ingresos − gastos ya ocurridos",
que no es ninguna de las dos cosas que la persona necesita saber: no descuenta
lo que está comprometido y no mira hacia adelante. Este endpoint junta piezas
que ya existían por separado —sueldo, suscripciones, cuotas, saldos— y las
cruza; el cálculo vive en motor/flujo.py, sin SQL, para poder probarlo.

El día de pago sale del sueldo detectado: es la última vez que se vio el abono
recurrente. Si no hay abono reconocible no se proyecta, y la app lo dice.
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends

from . import db
from .perfil import sueldo_detectado, sueldo_mensual
from .sesion_actual import usuario_actual
from .suscripciones import AL_MES

from motor.flujo import Compromiso, excedente_mensual, flujo_hasta_el_pago, proximo_pago

router = APIRouter(prefix="/api/flujo", tags=["Flujo de caja"])

#: Cuánto historial se mira para estimar el gasto variable. Un año captura las
#: estaciones (marzo escolar, diciembre) sin arrastrar hábitos ya abandonados.
MESES_DE_HISTORIAL = 12


def _saldo_total(conn, usuario_id: str) -> float:
    fila = conn.execute(
        "SELECT COALESCE(SUM(saldo), 0) AS saldo FROM cuenta WHERE usuario_id = %s",
        (usuario_id,),
    ).fetchone()
    return float(fila["saldo"])


def _suscripciones(conn, usuario_id: str) -> list[dict]:
    """Gastos fijos vigentes: los detectados y confirmados, no los descartados."""
    filas = conn.execute(
        """
        SELECT nombre, periodicidad, monto_esperado, proxima_fecha_estimada
        FROM suscripcion
        WHERE usuario_id = %s AND estado <> 'descartada'
        """,
        (usuario_id,),
    ).fetchall()
    return [dict(f) for f in filas]


def _creditos(conn, usuario_id: str) -> list[dict]:
    """
    Créditos que todavía se están pagando.

    Vigente se decide por las cuotas que faltan, no por la columna `estado`:
    esa guarda el texto tal como lo manda la institución ("Vigente", "Activo",
    lo que use cada banco) y no es un valor sobre el que se pueda filtrar. Es
    el mismo criterio que usa /api/creditos, para que las dos pantallas no
    muestren totales distintos.
    """
    filas = conn.execute(
        """
        SELECT producto, cuota_mensual, dia_de_pago
        FROM credito
        WHERE usuario_id = %s
          AND cuota_mensual IS NOT NULL
          AND COALESCE(cuotas_restantes, 0) > 0
        """,
        (usuario_id,),
    ).fetchall()
    return [dict(f) for f in filas]


def _inicio_del_historial(hoy: date) -> date:
    """El primer día del mes que abre la ventana de historial."""
    mes = hoy.month - MESES_DE_HISTORIAL
    return date(hoy.year + (mes - 1) // 12, (mes - 1) % 12 + 1, 1)


def _gasto_variable_por_mes(conn, usuario_id: str, hoy: date) -> list[float]:
    """
    Gasto de meses COMPLETOS, sin lo recurrente.

    Se excluye el mes en curso: va a medias y arrastraría la mediana hacia
    abajo justo cuando se la usa para proyectar lo que falta del mes.
    """
    filas = conn.execute(
        """
        SELECT to_char(t.fecha, 'YYYY-MM') AS mes, SUM(-t.monto) AS gasto
        FROM transaccion t
        JOIN cuenta c ON c.id = t.cuenta_id
        WHERE c.usuario_id = %s
          AND t.monto < 0
          AND t.estado <> 'excluido'
          AND NOT t.es_recurrente
          AND t.suscripcion_id IS NULL
          AND t.fecha >= %s
          AND to_char(t.fecha, 'YYYY-MM') <> %s
        GROUP BY 1
        ORDER BY 1
        """,
        (usuario_id, _inicio_del_historial(hoy), f"{hoy.year:04d}-{hoy.month:02d}"),
    ).fetchall()
    return [float(f["gasto"]) for f in filas]


def _dia_de_pago(conn, usuario_id: str) -> int | None:
    """
    El día del mes en que llega el sueldo, según el último abono reconocido.

    Sale del detector y no de un campo configurable a propósito: el dato ya
    está en la cuenta y preguntarlo sería pedir algo que el sistema sabe.
    """
    s = sueldo_detectado(conn, usuario_id)
    return s.hasta.day if s else None


@router.get("", summary="Excedente del mes y proyección hasta el día de pago")
def ver_flujo(usuario_id: str = Depends(usuario_actual)):
    hoy = datetime.now(timezone.utc).date()

    with db.conectar(diccionarios=True) as conn:
        ingreso = sueldo_mensual(conn, usuario_id)
        saldo = _saldo_total(conn, usuario_id)
        suscripciones = _suscripciones(conn, usuario_id)
        creditos = _creditos(conn, usuario_id)
        variable = _gasto_variable_por_mes(conn, usuario_id, hoy)
        dia_pago = _dia_de_pago(conn, usuario_id)

    fijos_al_mes = sum(
        float(s["monto_esperado"] or 0) * AL_MES.get(s["periodicidad"] or "", 0)
        for s in suscripciones
    )
    cuotas_al_mes = sum(float(c["cuota_mensual"]) for c in creditos)
    e = excedente_mensual(ingreso, fijos_al_mes, cuotas_al_mes)

    # Los cargos conocidos que vienen. La suscripción trae su propia fecha
    # estimada; la cuota solo el día del mes, así que se ubica en el ciclo con
    # la misma regla que el sueldo.
    compromisos = [
        Compromiso(nombre=s["nombre"],
                   monto=float(s["monto_esperado"] or 0),
                   fecha=s["proxima_fecha_estimada"])
        for s in suscripciones if s["monto_esperado"]
    ] + [
        Compromiso(nombre=c["producto"] or "Cuota",
                   monto=float(c["cuota_mensual"]),
                   fecha=proximo_pago(c["dia_de_pago"], hoy) if c["dia_de_pago"] else None)
        for c in creditos
    ]

    f = flujo_hasta_el_pago(saldo, dia_pago, compromisos, variable, hoy)

    return {
        "excedente": {
            "ingreso": round(e.ingreso),
            "gastosFijos": round(e.gastos_fijos),
            "cuotas": round(e.cuotas),
            "excedente": round(e.excedente),
            # Sin sueldo conocido el excedente es solo "lo comprometido en
            # negativo": la app tiene que poder decirlo en vez de mostrarlo.
            "ingresoConocido": ingreso > 0,
        },
        "flujo": None if f is None else {
            "saldo": round(f.saldo),
            "proximoPago": f.proximo_pago.isoformat(),
            "dias": f.dias,
            "comprometido": round(f.comprometido),
            "holgura": round(f.holgura),
            "gastoEstimado": round(f.gasto_estimado),
            "proyectado": round(f.proyectado),
            "mesesObservados": f.meses_observados,
            "proximosCargos": [
                {"nombre": c.nombre, "monto": round(c.monto), "fecha": c.fecha.isoformat()}
                for c in sorted((c for c in compromisos
                                 if c.fecha and hoy < c.fecha <= f.proximo_pago),
                                key=lambda c: c.fecha)
            ],
        },
    }
