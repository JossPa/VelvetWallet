# -*- coding: utf-8 -*-
"""
La cascada completa: lo que la ingesta llama para clasificar un movimiento.

    glosa  ──►  1) reglas           ─► categoría (si una regla reconoce el comercio)
                2) modelo entrenado ─► categoría (si supera el umbral de confianza)
                3) abstención       ─► None  → el movimiento va a "Por revisar"

Devuelve también de dónde salió la categoría (`origen`) y la confianza, que la
tabla `transaccion` guarda para trazabilidad y para medir la cobertura.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from .reglas import clasificar_por_reglas

log = logging.getLogger(__name__)

# Ruta del modelo entrenado. No se versiona: se genera solo la primera vez (ver
# _cargar_modelo) y lo reemplaza el reentrenamiento con correcciones.
RUTA_MODELO = Path(__file__).resolve().parent / "modelo.joblib"

_modelo = None        # ClasificadorGastos; se importa al cargar (necesita sklearn)
_sin_modelo = False   # si entrenar falló una vez, no reintentar en cada glosa


def _cargar_modelo():
    """
    Carga el modelo una sola vez (cache de módulo). Si no existe o se entrenó
    con otra versión de scikit-learn, lo entrena de nuevo con el dataset base:
    es determinista y tarda unos segundos. Si ni eso se puede, None: la cascada
    sigue solo con reglas.
    """
    global _modelo, _sin_modelo
    if _modelo is not None or _sin_modelo:
        return _modelo
    try:
        from .modelo import ClasificadorGastos
        _modelo = ClasificadorGastos.cargar(RUTA_MODELO)
    except Exception as e:  # noqa: BLE001 — no existe, versión distinta o archivo dañado
        log.info("Modelo no disponible (%s): se entrena con el dataset base.", e)
        try:
            from .entrenar import entrenar_base
            _modelo = entrenar_base()
        except Exception:  # noqa: BLE001
            log.exception("No se pudo entrenar el clasificador; quedan solo las reglas.")
            _sin_modelo = True
    return _modelo


def recargar() -> None:
    """Olvida el modelo en memoria (después de reentrenar)."""
    global _modelo, _sin_modelo
    _modelo, _sin_modelo = None, False


@dataclass
class Resultado:
    categoria: str | None       # None = el sistema se abstiene
    origen: str                 # "modelo" | "regla" | "abstencion"
    confianza: float | None     # probabilidad del modelo; None para reglas


def clasificar_lote(glosas: list[str]) -> list[Resultado]:
    """
    La misma cascada para muchas glosas de una vez. Es lo que usa la ingesta:
    el modelo predice todas juntas en una sola pasada (unas 30 veces más
    rápido que una por una).
    """
    resultados: list[Resultado | None] = [None] * len(glosas)
    al_modelo: list[int] = []
    for i, glosa in enumerate(glosas):
        glosa = (glosa or "").strip()
        if not glosa:
            resultados[i] = Resultado(None, "abstencion", None)
            continue
        por_regla = clasificar_por_reglas(glosa)
        if por_regla is not None:
            resultados[i] = Resultado(por_regla, "regla", None)
        else:
            al_modelo.append(i)

    modelo = _cargar_modelo() if al_modelo else None
    if al_modelo and modelo is None:
        for i in al_modelo:
            resultados[i] = Resultado(None, "abstencion", None)
    elif al_modelo:
        predichos = modelo.predecir_lote([glosas[i].strip() for i in al_modelo])
        for i, (categoria, confianza) in zip(al_modelo, predichos):
            resultados[i] = (Resultado(categoria, "modelo", confianza) if categoria is not None
                             else Resultado(None, "abstencion", confianza))
    return resultados  # type: ignore[return-value]


def precalentar() -> None:
    """Carga (o entrena) el modelo ahora, para que la primera sincronización no espere."""
    _cargar_modelo()


def clasificar(glosa: str) -> Resultado:
    """
    Aplica la cascada a una glosa y devuelve la categoría o la abstención.

    Orden "reglas primero, modelo después": lo medimos (metricas.json). Una
    regla solo calza cuando reconoce el nombre del comercio, y ahí no se
    equivoca; el modelo aporta lo que las reglas no reconocen (abreviaturas,
    erratas, formas nuevas). Al revés, el modelo a veces asigna con seguridad
    un comercio que nunca vio a la categoría de otro parecido ("METRO GAS" →
    Transporte por "METRO"), y la regla lo habría resuelto bien.

    Una regla no tiene confianza parcial (acierta o no), por eso su confianza
    es None: así la distingue la API ("la clasificó una regla").
    """
    glosa = (glosa or "").strip()
    if not glosa:
        return Resultado(None, "abstencion", None)

    por_regla = clasificar_por_reglas(glosa)
    if por_regla is not None:
        return Resultado(por_regla, "regla", None)

    modelo = _cargar_modelo()
    if modelo is None:
        return Resultado(None, "abstencion", None)
    categoria, confianza = modelo.predecir(glosa)
    if categoria is not None:
        return Resultado(categoria, "modelo", confianza)
    return Resultado(None, "abstencion", confianza)
