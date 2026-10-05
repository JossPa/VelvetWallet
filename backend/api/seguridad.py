# -*- coding: utf-8 -*-
"""
Seguridad: hash de contraseñas y tokens de sesión.

  · La contraseña NUNCA se guarda en texto plano. Se guarda su hash con bcrypt,
    que incluye una sal distinta por usuario (RNF-16 / RF-31).
  · El token es un JWT firmado con una clave secreta. Lleva el id del usuario y
    una fecha de expiración. La app lo guarda y lo manda como Bearer.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt  # PyJWT

from . import config


def hashear_password(password: str) -> str:
    """Devuelve el hash bcrypt (texto) para guardar en usuario.hash_password."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, hash_guardado: str) -> bool:
    """Compara la contraseña ingresada con el hash guardado."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hash_guardado.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def crear_token(usuario_id: str) -> tuple[str, str]:
    """
    Crea el token de sesión. Devuelve (token, fecha_de_expiracion_iso).
    La fecha se devuelve también aparte porque la app la usa como `expiraEn`.
    """
    expira = datetime.now(timezone.utc) + timedelta(days=config.TOKEN_DIAS)
    token = jwt.encode(
        {"sub": usuario_id, "exp": expira},
        config.JWT_SECRET,
        algorithm="HS256",
    )
    return token, expira.isoformat()
