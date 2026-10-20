# -*- coding: utf-8 -*-
"""
"Portero" de sesión: valida el token del login y dice QUIÉN es el usuario.

Esta es la pieza clave del aislamiento entre usuarios. Cada petición a un
endpoint protegido trae el token (Authorization: Bearer <token>). Aquí se
verifica la firma y se extrae el id del usuario que inició sesión. Los endpoints
usan ese id para consultar SOLO los datos de ese usuario: nadie puede ver lo de
otro, porque el id no lo pone el cliente, lo pone el token firmado por nosotros.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt  # PyJWT

from . import config

_bearer = HTTPBearer(auto_error=False)


def usuario_actual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    """
    Dependencia de FastAPI. Devuelve el id (uuid, como texto) del usuario dueño
    del token. Lanza 401 si el token falta, está vencido o es inválido.
    """
    if cred is None or not cred.credentials:
        raise HTTPException(status_code=401, detail="Falta el token de sesión.")
    try:
        datos = jwt.decode(cred.credentials, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="La sesión expiró. Inicia sesión de nuevo.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token de sesión inválido.")

    uid = datos.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Token de sesión sin usuario.")
    return uid
