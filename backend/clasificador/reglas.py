# -*- coding: utf-8 -*-
"""
Reglas por palabra clave: la PRIMERA capa de la cascada (tarea E2).

Son las mismas reglas que ya corren en la app (movil/src/utils/sugerencias.ts),
portadas al backend. Resuelven los comercios conocidos sin modelo: es lo barato,
lo rápido y lo de máxima precisión. Si ninguna regla calza, esta capa NO inventa:
devuelve None y deja que decida el modelo (o, si el modelo tampoco está seguro,
que el movimiento caiga en "Por revisar").
"""
from __future__ import annotations

import re

# El orden importa: gana la primera que calza.
REGLAS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(CGE|ENEL|SAESA)\b", re.I), "Servicios"),
    (re.compile(r"\b(ESSAL|AGUAS|ESVAL)\b", re.I), "Servicios"),
    (re.compile(r"(ABASTIBLE|LIPIGAS|GASCO|METRO\s*GAS)", re.I), "Servicios"),
    (re.compile(r"\b(ENTEL|VTR|MOVISTAR|CLARO|WOM)\b", re.I), "Servicios"),
    (re.compile(r"SERVIPAG", re.I), "Servicios"),
    (re.compile(r"(SPOTIFY|NETFLIX|DISNEY|HBO|PRIME VIDEO|YOUTUBE)", re.I), "Entretención"),
    (re.compile(r"(UBER|CABIFY|DIDI)\s*\*?\s*EATS|RAPPI|PEDIDOS\s*-?\s*YA", re.I), "Delivery"),
    (re.compile(r"(STARBUCKS|JUAN VALDEZ|DUNKIN)", re.I), "Restaurantes"),
    (re.compile(r"(COPEC|SHELL|PETROBRAS|UBER|CABIFY|DIDI|\bMETRO\b|\bBIP\b)", re.I), "Transporte"),
    (re.compile(r"(LIDER|JUMBO|UNIMARC|SANTA ISABEL|TOTTUS|ACUENTA)", re.I), "Supermercado"),
    (re.compile(r"(FARMACIA|AHUMADA|CRUZ VERDE|SALCOBRAND)", re.I), "Salud"),
    (re.compile(r"(SMART ?FIT|SPORTLIFE|PACIFIC FITNESS|GYM)", re.I), "Gimnasio"),
    (re.compile(r"(ICLOUD|DROPBOX|APPLE\.COM|MICROSOFT 365)", re.I), "Suscripciones"),
    (re.compile(r"(ARRIENDO|DIVIDENDO|INMOBILIARIA)", re.I), "Vivienda"),
    (re.compile(r"(COLEGIO|UNIVERSIDAD|INSTITUTO|MENSUALIDAD)", re.I), "Educación"),
    (re.compile(r"(SODIMAC|HOMECENTER|\bEASY\b)", re.I), "Hogar"),
    (re.compile(r"(FALABELLA|PARIS|RIPLEY|H&M|ZARA)", re.I), "Vestuario"),
]


def clasificar_por_reglas(glosa: str) -> str | None:
    """Devuelve la categoría si una regla reconoce la glosa; None si ninguna calza."""
    texto = glosa or ""
    for patron, categoria in REGLAS:
        if patron.search(texto):
            return categoria
    return None
