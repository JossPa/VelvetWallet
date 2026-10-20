# -*- coding: utf-8 -*-
"""
Consentimiento por finalidad de tratamiento (Ley 21.719).

  GET  /api/privacidad/finalidades        -> qué se pide y si está consentido
  POST /api/privacidad/finalidades/{id}   -> otorgar o revocar

Por qué existe aparte del consentimiento bancario: autorizar a Velvet a LEER
los datos del banco no autoriza a USARLOS para otra cosa. Entrenar un modelo
con los gastos de alguien es una finalidad distinta de mostrárselos, y la ley
pide consentimiento específico, informado y revocable **para cada una**.

Tres reglas que el código hace cumplir, no solo declara:
  · Nadie queda consentido por omisión: sin fila, no hay permiso.
  · El consentimiento vence (90 días) y hay que renovarlo.
  · Revocar no borra la fila; la marca. Queda el registro de que existió.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import db
from .sesion_actual import usuario_actual

router = APIRouter(prefix="/api/privacidad", tags=["Privacidad"])

# Vigencia del consentimiento. La misma que el acceso bancario, para que la
# persona no tenga que acordarse de dos plazos distintos.
DIAS_VIGENCIA = 90

# Versión del texto que se le muestra a la persona. Si el texto cambia —si se
# amplía lo que se hace con los datos— esta versión sube y los consentimientos
# otorgados sobre el texto anterior dejan de cubrir la finalidad nueva: hay que
# volver a pedirlo. Consentir no es un "sí" permanente a lo que venga.
VERSION_TEXTO = "2026-10-1"

# Catálogo de finalidades. Cada una se consiente por separado: no existe un
# "acepto todo".
FINALIDADES = {
    "entrenamiento_modelos": {
        "titulo": "Mejorar las categorías de gasto",
        "resumen": (
            "Usar el monto y el comercio de tus transacciones para entrenar los modelos "
            "que clasifican tus gastos."
        ),
        "detalle": [
            "Nos ayuda a acertar más al identificar en qué tipo de gasto y en qué comercios "
            "concentras tu plata, y a mejorar las proyecciones que te mostramos.",
            "Es específico para este fin: no usamos estos datos para otra cosa, no los vendemos "
            "ni los compartimos con terceros.",
            "Para entrenar trabajamos con tus datos de forma anonimizada y agregada siempre que "
            "es posible.",
            "Puedes revocarlo cuando quieras, gratis, desde esta misma pantalla. Al revocar "
            "dejamos de usar tus datos para este fin y quitamos de los conjuntos de "
            "entrenamiento los que estaban asociados a ti.",
            "Es voluntario: la aplicación funciona igual si no lo activas.",
        ],
        "vigencia_dias": DIAS_VIGENCIA,
    },
}


class Decision(BaseModel):
    acepta: bool


def _vigente(conn, usuario_id: str, finalidad: str):
    """Consentimiento vigente y no vencido. None si no hay."""
    fila = conn.execute(
        """SELECT fecha_inicio, fecha_expiracion, version_texto
           FROM consentimiento_tratamiento
           WHERE usuario_id = %s AND finalidad = %s AND estado = 'vigente'""",
        (usuario_id, finalidad),
    ).fetchone()
    if fila is None:
        return None

    # Vencido: se marca y se trata como si no existiera. No se renueva solo;
    # la persona tiene que volver a decidir.
    if fila[1] <= datetime.now(timezone.utc):
        conn.execute(
            """UPDATE consentimiento_tratamiento SET estado = 'expirado'
               WHERE usuario_id = %s AND finalidad = %s AND estado = 'vigente'""",
            (usuario_id, finalidad),
        )
        conn.commit()
        return None

    return fila


@router.get("/finalidades", summary="Para qué se piden los datos y qué autorizó la persona")
def listar_finalidades(usuario_id: str = Depends(usuario_actual)):
    salida = []
    with db.conectar() as conn:
        for clave, info in FINALIDADES.items():
            fila = _vigente(conn, usuario_id, clave)
            salida.append({
                "id": clave,
                **info,
                "consentido": fila is not None,
                "desde": fila[0].isoformat() if fila else None,
                "vence": fila[1].isoformat() if fila else None,
                # El texto cambió desde que lo aceptó: hay que volver a pedirlo.
                "textoDesactualizado": bool(fila and fila[2] != VERSION_TEXTO),
                "versionTexto": VERSION_TEXTO,
            })
    return {"finalidades": salida}


@router.post("/finalidades/{finalidad}", summary="Otorgar o revocar una finalidad")
def decidir(finalidad: str, decision: Decision, usuario_id: str = Depends(usuario_actual)):
    if finalidad not in FINALIDADES:
        raise HTTPException(status_code=404, detail="Finalidad desconocida.")

    with db.conectar() as conn:
        # Sea cual sea la decisión, lo vigente se cierra primero. Así nunca hay
        # dos consentimientos activos para la misma finalidad.
        conn.execute(
            """UPDATE consentimiento_tratamiento
               SET estado = 'revocado', revocado_at = now()
               WHERE usuario_id = %s AND finalidad = %s AND estado = 'vigente'""",
            (usuario_id, finalidad),
        )

        if decision.acepta:
            conn.execute(
                """INSERT INTO consentimiento_tratamiento
                       (usuario_id, finalidad, version_texto, fecha_expiracion)
                   VALUES (%s, %s, %s, %s)""",
                (
                    usuario_id,
                    finalidad,
                    VERSION_TEXTO,
                    datetime.now(timezone.utc) + timedelta(days=DIAS_VIGENCIA),
                ),
            )
        conn.commit()

    return {"finalidad": finalidad, "consentido": decision.acepta}


def usuarios_que_consienten(conn, finalidad: str) -> list[str]:
    """
    Quiénes autorizaron esa finalidad, con consentimiento vigente y sin vencer.

    **El reentrenamiento del clasificador debe filtrar por esto.** Entrenar con
    los datos de alguien que no consintió, o cuyo consentimiento venció, es
    justamente lo que la ley prohíbe, y el consentimiento no sirve de nada si
    el código que usa los datos no lo consulta.
    """
    filas = conn.execute(
        """SELECT usuario_id FROM consentimiento_tratamiento
           WHERE finalidad = %s AND estado = 'vigente' AND fecha_expiracion > now()""",
        (finalidad,),
    ).fetchall()
    return [str(f[0]) for f in filas]
