# -*- coding: utf-8 -*-
"""
Configuración del API.

Reutiliza la misma DATABASE_URL del resto del backend (ingesta). Agrega la
clave secreta para firmar los tokens. Todo por variable de entorno; en el .env.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:
    pass

# PostgreSQL (la misma tabla usuario del modelo canónico)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://velvet:cambia_esto_en_local@localhost:5432/velvet_wallet",
)

# Firma de los tokens de sesión (JWT). En producción, una clave larga y secreta.
JWT_SECRET = os.getenv("JWT_SECRET", "cambia-esta-clave-secreta-en-produccion")

# Duración del token en días (la app renueva cuando expira).
TOKEN_DIAS = int(os.getenv("TOKEN_DIAS", "30"))
