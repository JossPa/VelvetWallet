# -*- coding: utf-8 -*-
"""
Prueba rápida de conexión a MongoDB (Atlas).

Lee MONGO_URL del .env y hace un "ping". Sirve para confirmar que la URL y la
contraseña están bien ANTES de correr toda la ingesta.

    python probar_mongo.py
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from pymongo import MongoClient

url = os.getenv("MONGO_URL")
if not url:
    raise SystemExit("No hay MONGO_URL en el .env")

print("Conectando a MongoDB...")
cliente = MongoClient(url, serverSelectionTimeoutMS=8000)
cliente.admin.command("ping")
print("OK: conexión a MongoDB exitosa.")
print("Base de datos:", os.getenv("MONGO_DB", "velvet_wallet"))
cliente.close()
