# -*- coding: utf-8 -*-
"""
Asistente conversacional de Velvet Wallet.

El modelo de lenguaje no calcula ni ve los datos crudos: entiende la pregunta,
elige una herramienta y redacta con lo que la herramienta devolvió. Las
herramientas son las mismas funciones que alimentan las pantallas de la app,
así que el chat y el dashboard coinciden por construcción.

  herramientas.py  qué puede consultar y qué forma tiene cada respuesta
  conversacion.py  el ciclo pregunta → herramienta → respuesta
"""
