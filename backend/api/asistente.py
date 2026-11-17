# -*- coding: utf-8 -*-
"""
Asistente conversacional: la persona pregunta con sus palabras sobre su plata.

  POST /api/asistente   { mensajes: [{rol, texto}, ...] }  ->  { respuesta, consultas }

La lógica vive en `asesor/`; aquí quedan las tres condiciones que se revisan
antes de mandar nada a un proveedor externo:

  1. Sesión válida: las herramientas reciben el usuario del token, no del
     modelo, así que nadie puede preguntar por los datos de otro.
  2. Consentimiento vigente para la finalidad "asistente_ia" (Ley 21.719): es
     la única función que envía datos fuera de Velvet, y no se hace sin un
     permiso específico y revocable.
  3. Que el asistente esté configurado (clave de Groq en el .env). Sin ella la
     app funciona igual y el asistente lo dice.

Se anota en la bitácora que hubo consulta, nunca el contenido de la pregunta:
la bitácora registra hechos de tratamiento, no copia los datos.
"""
import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from asesor.conversacion import AsistenteNoDisponible, responder_con_respaldo
from asesor.herramientas import Herramientas

from . import bitacora, config, db
from .privacidad import consentimiento_vigente
from .sesion_actual import usuario_actual

router = APIRouter(prefix="/api/asistente", tags=["Asistente"])
log = logging.getLogger("uvicorn.error")

FINALIDAD = "asistente_ia"


class Mensaje(BaseModel):
    rol: Literal["usuario", "asistente"]
    texto: str = Field(min_length=1, max_length=1000)


class Conversacion(BaseModel):
    #: El historial lo guarda la app; el servidor no lo almacena.
    mensajes: list[Mensaje] = Field(min_length=1, max_length=40)


def _cliente():
    """
    Cliente de Groq. Ante un 429 el SDK espera lo que indica el proveedor
    (`retry-after`) y reintenta: el plan gratuito limita los tokens por minuto
    y, con preguntas seguidas, es preferible esperar unos segundos a fallar.
    """
    from groq import Groq
    return Groq(api_key=config.GROQ_API_KEY, timeout=45, max_retries=2)


@router.post("", summary="Preguntarle al asistente sobre tus datos")
def preguntar(conversacion: Conversacion, peticion: Request,
              usuario_id: str = Depends(usuario_actual)):
    if conversacion.mensajes[-1].rol != "usuario":
        raise HTTPException(status_code=422, detail="El último mensaje tiene que ser una pregunta.")

    with db.conectar() as conn:
        if not consentimiento_vigente(conn, usuario_id, FINALIDAD):
            raise HTTPException(status_code=403, detail={
                "codigo": "sin_consentimiento",
                "mensaje": "Para usar el asistente necesitas autorizarlo en Privacidad.",
            })
        if not config.GROQ_API_KEY:
            raise HTTPException(status_code=503, detail={
                "codigo": "no_configurado",
                "mensaje": "El asistente no está configurado en este servidor.",
            })
        # Agrupado por media hora: una conversación son varias preguntas
        # seguidas y la persona necesita leer "consultaste al asistente", no
        # una fila por mensaje.
        bitacora.registrar(conn, usuario_id, "asistente.consultar", "Asistente conversacional",
                           bitacora.ip_de(peticion), agrupar_minutos=30)
        conn.commit()

    hoy = datetime.now(timezone.utc).date()
    modelos = [m for m in (config.ASISTENTE_MODELO, config.ASISTENTE_MODELO_RESPALDO) if m]
    try:
        r = responder_con_respaldo(_cliente(), modelos, Herramientas(usuario_id, hoy),
                                   [m.model_dump() for m in conversacion.mensajes], hoy)
    except AsistenteNoDisponible as e:
        # Al registro del servidor va el motivo (cuota, red), nunca la pregunta.
        log.warning("Asistente no disponible: %s", str(e)[:300])
        raise HTTPException(status_code=503, detail={
            "codigo": "no_disponible",
            "mensaje": "El asistente no está respondiendo ahora. Prueba en un minuto.",
        })

    return {"respuesta": r.texto, "consultas": r.consultas}
