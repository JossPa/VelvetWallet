# -*- coding: utf-8 -*-
"""
Notificación de brechas de datos personales (Ley 21.719, RF-29).

  GET  /api/incidentes             -> brechas que afectan al usuario del token
  POST /api/incidentes/{id}/visto  -> el titular marca que lo leyó

Qué obliga la ley: ante una vulneración de seguridad que afecte datos
personales hay que notificar a la autoridad y, cuando hay riesgo para los
titulares, a cada uno de ellos. El plazo es de 72 horas desde que se toma
conocimiento.

Qué hace este módulo: el lado del titular. Muestra el aviso dentro de la
aplicación y deja constancia de que lo vio.

Quién registra un incidente: el Delegado de Protección de Datos, con el script
`backend/registrar_incidente.py`. No hay un endpoint para crearlo a propósito.
Declarar una brecha es una decisión con consecuencias legales, no una
operación de usuario, y exponerla como endpoint obligaría a inventar un rol de
administrador que este sistema no tiene. Es más honesto que el procedimiento
quede explícito y fuera de la aplicación.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row

import psycopg

from . import config
from .sesion_actual import usuario_actual
from motor.brechas import describir, plazo_de

router = APIRouter(prefix="/api/incidentes", tags=["Incidentes de seguridad"])


def _conectar():
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


@router.get("", summary="Brechas de seguridad que te afectan")
def listar(usuario_id: str = Depends(usuario_actual)):
    """
    Solo las que afectan a quien pregunta.

    Una persona no tiene por qué enterarse de una brecha que no la tocó, y
    mostrar todas convertiría el aviso en ruido: el que sí le afecta se
    perdería entre los demás.
    """
    with _conectar() as conn:
        filas = conn.execute(
            """
            SELECT i.id, i.titulo, i.descripcion, i.datos_afectados, i.medidas,
                   i.gravedad, i.estado, i.ocurrido_at, i.detectado_at,
                   i.notificado_at, i.autoridad_avisada_at,
                   a.avisado_at, a.visto_at
            FROM incidente_afectado a
            JOIN incidente_seguridad i ON i.id = a.incidente_id
            WHERE a.usuario_id = %s
            ORDER BY i.detectado_at DESC
            """,
            (usuario_id,),
        ).fetchall()

    def iso(v):
        return v.isoformat() if v else None

    incidentes = []
    for f in filas:
        p = plazo_de(f["detectado_at"], f["notificado_at"], datetime.now(timezone.utc))
        incidentes.append({
            "id": str(f["id"]),
            "titulo": f["titulo"],
            "descripcion": f["descripcion"],
            "datosAfectados": f["datos_afectados"],
            "medidas": f["medidas"],
            "gravedad": f["gravedad"],
            "ocurrido": iso(f["ocurrido_at"]),
            "detectado": iso(f["detectado_at"]),
            "avisado": iso(f["avisado_at"]),
            "visto": iso(f["visto_at"]),
            "autoridadAvisada": iso(f["autoridad_avisada_at"]),
            # El estado del plazo se calcula, no se guarda: guardado quedaría
            # desactualizado apenas pasa una hora.
            "plazo": {
                "venceEn": p.vence_at.isoformat(),
                "notificado": p.notificado,
                "dentroDePlazo": not p.vencido,
                "descripcion": describir(p),
            },
        })

    return {
        "incidentes": incidentes,
        "sinLeer": sum(1 for i in incidentes if i["visto"] is None),
    }


@router.post("/{incidente_id}/visto", summary="Marcar el aviso como leído")
def marcar_visto(incidente_id: str, usuario_id: str = Depends(usuario_actual)):
    """
    Deja constancia de que el titular leyó el aviso.

    No borra nada: el incidente sigue en su historial. Lo que cambia es que
    deja de aparecer como pendiente, y queda registrado cuándo lo leyó, que es
    parte de poder demostrar que la notificación llegó.
    """
    with _conectar() as conn:
        fila = conn.execute(
            """UPDATE incidente_afectado SET visto_at = COALESCE(visto_at, now())
               WHERE incidente_id::text = %s AND usuario_id = %s
               RETURNING visto_at""",
            (incidente_id, usuario_id),
        ).fetchone()
        if fila is None:
            raise HTTPException(status_code=404, detail="Aviso no encontrado.")
        conn.commit()

    return {"visto": fila["visto_at"].isoformat()}
