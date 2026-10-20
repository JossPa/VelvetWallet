# -*- coding: utf-8 -*-
"""
Clasificador de gastos de Velvet Wallet (bloque E).

Cascada: reglas → modelo entrenado → abstención. Punto de entrada para la
ingesta: `from clasificador import clasificar`.

El modelo necesita scikit-learn; si no está instalado, la cascada sigue
funcionando solo con las reglas (y se abstiene en lo demás).
"""
from .clasificar import Resultado, clasificar, recargar
from .reglas import clasificar_por_reglas

__all__ = ["clasificar", "Resultado", "recargar", "clasificar_por_reglas"]
