# -*- coding: utf-8 -*-
"""
API HTTP del backend de Velvet Wallet.

Hoy expone la autenticación (contra la tabla usuario). Más adelante aquí se
montan también los endpoints que la app consume para movimientos, cuentas, etc.

Correr desde la carpeta backend/ con:

    uvicorn api.main:app --reload --port 8000

Va en el puerto 8000 (el simulador usa el 8001), así conviven los dos.
Documentación interactiva: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router

app = FastAPI(
    title="Velvet Wallet — API",
    version="1.0.0",
    description="Backend de Velvet Wallet. Autenticación contra el modelo canónico (Postgres).",
)

# Permite que la app (que corre en otro puerto, p. ej. 8081 en web) consuma el
# API desde el navegador. En producción se restringe a los orígenes autorizados.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/health", tags=["Operación"], summary="Comprobación de vida")
def health():
    return {"ok": True, "servicio": "velvet-api"}
