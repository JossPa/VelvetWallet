# -*- coding: utf-8 -*-
"""
Metas de ahorro y su proyección (RF-24 / RF-26).

  GET    /api/metas       -> metas del usuario, cada una con su proyección
  POST   /api/metas       -> crear
  PATCH  /api/metas/{id}  -> actualizar (típicamente, lo que se lleva ahorrado)
  DELETE /api/metas/{id}  -> eliminar

Este módulo no calcula nada: arma los datos, se los pasa a `motor.proyeccion` y
guarda el resultado. La matemática vive aparte justamente para poder probarla
sin base de datos (ver backend/pruebas/test_proyeccion.py).

La proyección se recalcula en cada lectura y además se **guarda** en la fila.
Recalcular mantiene la respuesta al día con el historial; guardarla deja
registro de qué se le dijo a la persona y cuándo, que es lo que permite
después contrastar lo proyectado con lo que efectivamente pasó.
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

import psycopg

from . import config, db
from .sesion_actual import usuario_actual
from motor.proyeccion import Proyeccion, excedentes_observados, proyectar

router = APIRouter(prefix="/api/metas", tags=["Metas"])


class MetaNueva(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    montoObjetivo: float = Field(gt=0)
    montoAhorrado: float = Field(default=0, ge=0)
    fechaObjetivo: date | None = None


class MetaCambio(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    montoObjetivo: float | None = Field(default=None, gt=0)
    montoAhorrado: float | None = Field(default=None, ge=0)
    fechaObjetivo: date | None = None


def _conectar():
    return db.conectar(diccionarios=True)


# ───────────────────────── historial de excedentes ─────────────────────────

def _sueldo_mensual(conn, usuario_id: str) -> float:
    """
    Cuánto entra al mes.

    Primero el sueldo que la persona declaró (RF-36); es el dato más confiable
    porque lo puso ella. Si no lo declaró, se toma el abono recurrente más
    reciente que no sea una transferencia entre cuentas propias.

    Se usa un ingreso **constante**, no los abonos de cada mes, por el mismo
    principio que el resumen del panel: el sueldo llega a fin de mes, así que
    contar abonos reales dejaría casi todos los meses en rojo hasta el día de
    pago. Un bono o aguinaldo suelto queda fuera, y eso hace la proyección algo
    conservadora: prefiere prometer de menos.
    """
    fila = conn.execute(
        "SELECT sueldo_declarado FROM usuario WHERE id = %s", (usuario_id,)
    ).fetchone()
    if fila and fila["sueldo_declarado"] is not None:
        return float(fila["sueldo_declarado"])

    abono = conn.execute(
        """
        SELECT t.monto
        FROM transaccion t
        JOIN cuenta c ON c.id = t.cuenta_id
        WHERE c.usuario_id = %s
          AND t.monto > 0
          AND t.estado <> 'excluido'
          AND t.glosa_original !~* 'transferencia'
        ORDER BY t.fecha DESC
        LIMIT 1
        """,
        (usuario_id,),
    ).fetchone()
    return float(abono["monto"]) if abono else 0.0


def _gasto_por_mes(conn, usuario_id: str) -> dict[str, float]:
    """Gasto total de cada mes con movimientos, en positivo."""
    filas = conn.execute(
        """
        SELECT to_char(t.fecha, 'YYYY-MM') AS mes, SUM(-t.monto) AS gasto
        FROM transaccion t
        JOIN cuenta c ON c.id = t.cuenta_id
        WHERE c.usuario_id = %s AND t.monto < 0 AND t.estado <> 'excluido'
        GROUP BY 1
        """,
        (usuario_id,),
    ).fetchall()
    return {f["mes"]: float(f["gasto"]) for f in filas}


def _historial(conn, usuario_id: str) -> list[float]:
    """Excedente de cada mes completo observado."""
    hoy = datetime.now(timezone.utc)
    return excedentes_observados(
        _gasto_por_mes(conn, usuario_id),
        _sueldo_mensual(conn, usuario_id),
        mes_en_curso=f"{hoy.year}-{hoy.month:02d}",
    )


# ──────────────────────────── armado de la salida ───────────────────────────

def _probabilidad_a_la_fecha(p: Proyeccion, fecha_objetivo: date | None) -> float | None:
    """
    Con qué probabilidad se llega al plazo que la persona se propuso.

    Es la otra mitad de la pregunta: no solo "cuándo llego", también "¿llego a
    tiempo?". Sin fecha propuesta no hay nada que responder.
    """
    if fecha_objetivo is None or not p.curva:
        return None

    hoy = date.today()
    meses = (fecha_objetivo.year - hoy.year) * 12 + (fecha_objetivo.month - hoy.month)
    if meses < 1:
        return 0.0
    # Más allá del horizonte simulado, lo mejor que se puede decir es lo que
    # dice el último mes simulado.
    return p.curva[min(meses, len(p.curva)) - 1]


def _salida(fila: dict, p: Proyeccion) -> dict:
    objetivo = float(fila["monto_objetivo"])
    ahorrado = float(fila["monto_ahorrado"])
    return {
        "id": str(fila["id"]),
        "nombre": fila["nombre"],
        "montoObjetivo": objetivo,
        "montoAhorrado": ahorrado,
        "fechaObjetivo": fila["fecha_objetivo"].isoformat() if fila["fecha_objetivo"] else None,
        "creadaEn": fila["creada_en"].isoformat(),
        "avance": min(1.0, ahorrado / objetivo) if objetivo else 0.0,
        "proyeccion": {
            "estado": p.estado,
            "mesesObservados": p.meses_observados,
            "mesesMinimos": 3,
            "excedenteMediano": p.excedente_mediano,
            "excedentePeor": p.excedente_peor,
            "excedenteMejor": p.excedente_mejor,
            "curva": list(p.curva),
            "mesesP50": p.meses_p50,
            "mesesP80": p.meses_p80,
            "mesesP95": p.meses_p95,
            "probabilidadALaFecha": _probabilidad_a_la_fecha(p, fila["fecha_objetivo"]),
            "simulaciones": p.simulaciones,
            "horizonteMeses": p.horizonte_meses,
        },
    }


def _proyectar_y_guardar(conn, fila: dict, excedentes: list[float]) -> dict:
    p = proyectar(
        excedentes,
        ahorro_actual=float(fila["monto_ahorrado"]),
        objetivo=float(fila["monto_objetivo"]),
    )

    # Se deja registro de lo que se le dijo a la persona. La probabilidad que
    # se guarda es la del plazo informado (80%), que es el que muestra la app.
    conn.execute(
        """UPDATE meta
           SET probabilidad_estimada = %s, meses_estimados = %s, proyectada_en = now()
           WHERE id = %s""",
        (
            p.curva[p.meses_p80 - 1] if p.meses_p80 else None,
            p.meses_p80,
            fila["id"],
        ),
    )
    return _salida(fila, p)


# ───────────────────────────────── endpoints ────────────────────────────────

@router.get("", summary="Metas del usuario con su proyección")
def listar(usuario_id: str = Depends(usuario_actual)):
    with _conectar() as conn:
        excedentes = _historial(conn, usuario_id)
        filas = conn.execute(
            "SELECT * FROM meta WHERE usuario_id = %s ORDER BY creada_en",
            (usuario_id,),
        ).fetchall()
        metas = [_proyectar_y_guardar(conn, f, excedentes) for f in filas]
        conn.commit()

    return {"metas": metas, "mesesObservados": len(excedentes)}


@router.post("", status_code=201, summary="Crear una meta")
def crear(nueva: MetaNueva, usuario_id: str = Depends(usuario_actual)):
    with _conectar() as conn:
        fila = conn.execute(
            """INSERT INTO meta (usuario_id, nombre, monto_objetivo, monto_ahorrado, fecha_objetivo)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING *""",
            (usuario_id, nueva.nombre.strip(), nueva.montoObjetivo,
             nueva.montoAhorrado, nueva.fechaObjetivo),
        ).fetchone()
        meta = _proyectar_y_guardar(conn, fila, _historial(conn, usuario_id))
        conn.commit()

    return meta


@router.patch("/{meta_id}", summary="Actualizar una meta")
def actualizar(meta_id: str, cambio: MetaCambio, usuario_id: str = Depends(usuario_actual)):
    campos = {
        "nombre": cambio.nombre.strip() if cambio.nombre else None,
        "monto_objetivo": cambio.montoObjetivo,
        "monto_ahorrado": cambio.montoAhorrado,
        "fecha_objetivo": cambio.fechaObjetivo,
    }
    puestos = {k: v for k, v in campos.items() if v is not None}
    if not puestos:
        raise HTTPException(status_code=400, detail="No hay nada que cambiar.")

    asignaciones = ", ".join(f"{k} = %s" for k in puestos)
    with _conectar() as conn:
        # El filtro por usuario_id va en el WHERE, no en una comprobación
        # aparte: así es imposible tocar la meta de otra persona.
        fila = conn.execute(
            f"UPDATE meta SET {asignaciones} WHERE id = %s AND usuario_id = %s RETURNING *",
            (*puestos.values(), meta_id, usuario_id),
        ).fetchone()
        if fila is None:
            raise HTTPException(status_code=404, detail="Meta no encontrada.")
        meta = _proyectar_y_guardar(conn, fila, _historial(conn, usuario_id))
        conn.commit()

    return meta


@router.delete("/{meta_id}", status_code=204, summary="Eliminar una meta")
def eliminar(meta_id: str, usuario_id: str = Depends(usuario_actual)):
    with _conectar() as conn:
        borrada = conn.execute(
            "DELETE FROM meta WHERE id = %s AND usuario_id = %s RETURNING id",
            (meta_id, usuario_id),
        ).fetchone()
        conn.commit()
    if borrada is None:
        raise HTTPException(status_code=404, detail="Meta no encontrada.")
