# -*- coding: utf-8 -*-
"""
Configuración de la ingesta.

Todo lo que cambia entre "simulador" y "banco real" vive aquí: la URL base del
proveedor SFA, las credenciales del participante y las credenciales de las
bases. Nada de esto está escrito a mano en el código de más adentro, para que
pasar a producción sea cambiar variables de entorno, no reescribir la lógica.
"""
import os
from pathlib import Path

# Carga backend/.env si existe (python-dotenv). Si no está instalado o no hay
# archivo, se usan las variables de entorno del sistema y los defaults de abajo.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:
    pass


# ── Proveedor SFA (hoy la EFS; mañana el banco real) ────────────────────────
# La única diferencia con un banco real es esta URL y la autenticación
# (ver cliente_sfa.py). La EFS ya habla el mismo estándar de la CMF.
SFA_BASE_URL = os.getenv("SFA_BASE_URL", "http://localhost:8001/accounts/v1")

# ── Credenciales del participante (Client Credentials) ──────────────────────
# En ATENA se obtienen al habilitar la institución. Aquí, valores de demo que
# deben coincidir con los que espera la EFS (simulador/app/main.py).
SFA_CLIENT_ID = os.getenv("SFA_CLIENT_ID", "velvet-wallet")
SFA_CLIENT_SECRET = os.getenv("SFA_CLIENT_SECRET", "secreto-demo")

# ── PostgreSQL (modelo canónico) ────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://velvet:cambia_esto_en_local@localhost:5432/velvet_wallet",
)

# ── MongoDB (payloads crudos) ───────────────────────────────────────────────
MONGO_URL = os.getenv(
    "MONGO_URL",
    "mongodb://velvet:cambia_esto_en_local@localhost:27017/?authSource=admin",
)
MONGO_DB = os.getenv("MONGO_DB", "velvet_wallet")

# ── Identidad de demostración ───────────────────────────────────────────────
# En producción el usuario, la institución y la conexión nacen del registro y
# del flujo de consentimiento (OAuth). Para poder correr la ingesta sin esa
# parte todavía, se siembran de forma idempotente (ver bootstrap.py).
USUARIO_EMAIL     = os.getenv("USUARIO_EMAIL", "demo@velvetwallet.cl")
USUARIO_NOMBRE    = os.getenv("USUARIO_NOMBRE", "Usuario Demo")
INSTITUCION_NOMBRE = os.getenv("INSTITUCION_NOMBRE", "Banco Simulado SFA")
