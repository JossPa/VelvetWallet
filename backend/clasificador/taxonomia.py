# -*- coding: utf-8 -*-
"""
Taxonomía del clasificador: las categorías de Velvet Wallet y el mapeo de
referencia comercio → categoría.

Esta taxonomía es la de Velvet, NO la del banco. El estándar SFA no obliga a una
taxonomía común entre instituciones (cada banco manda la suya en
`merchantDetails.category`), y ese es justamente el problema que resuelve el
clasificador: llevar cualquier glosa, venga como venga, a ESTAS categorías.
"""
from __future__ import annotations

# Categorías canónicas de gasto de Velvet Wallet.
CATEGORIAS = [
    "Supermercado",
    "Delivery",
    "Restaurantes",
    "Transporte",
    "Servicios",
    "Entretención",
    "Suscripciones",
    "Salud",
    "Gimnasio",
    "Vivienda",
    "Vestuario",
    "Educación",
    "Hogar",
]

# Verdad de referencia comercio → categoría de Velvet (etiquetas "gold"). Cubre
# todos los comercios de los clientes de la EFS (perfiles profesional, familia y
# estudiante).
#
# Es más específica que la taxonomía del banco a propósito: el banco manda
# "Salud" para Smart Fit, "Servicios" para iCloud y "Restaurantes" tanto para
# Rappi como para Starbucks; nosotros los separamos porque al usuario le
# importan como gastos distintos (el gimnasio no es la farmacia, pedir comida
# no es tomarse un café).
GOLD_COMERCIO = {
    # Supermercado
    "Lider": "Supermercado",
    "Jumbo": "Supermercado",
    "Unimarc": "Supermercado",
    "Santa Isabel": "Supermercado",
    "Tottus": "Supermercado",
    # Delivery
    "Uber Eats": "Delivery",
    "Rappi": "Delivery",
    "PedidosYa": "Delivery",
    # Restaurantes y cafés
    "Starbucks": "Restaurantes",
    # Transporte
    "Copec": "Transporte",
    "Shell": "Transporte",
    "Uber": "Transporte",
    "Metro de Santiago": "Transporte",
    # Servicios del hogar (luz, agua, gas, internet, teléfono)
    "CGE": "Servicios",
    "Enel": "Servicios",
    "Essal": "Servicios",
    "Aguas Andinas": "Servicios",
    "Abastible": "Servicios",
    "Metrogas": "Servicios",
    "Entel": "Servicios",
    "VTR": "Servicios",
    # Entretención
    "Netflix": "Entretención",
    "Spotify": "Entretención",
    "Spotify Familiar": "Entretención",
    "Disney+": "Entretención",
    "YouTube Premium": "Entretención",
    # Suscripciones (almacenamiento y software)
    "iCloud": "Suscripciones",
    # Salud
    "Farmacia Ahumada": "Salud",
    "Cruz Verde": "Salud",
    # Gimnasio
    "Smart Fit": "Gimnasio",
    # Vivienda
    "Inmobiliaria Los Robles": "Vivienda",
    "Arriendos Estudiantiles SpA": "Vivienda",
    "Dividendo Hipotecario": "Vivienda",
    # Vestuario y tiendas por departamento
    "Falabella": "Vestuario",
    "Paris": "Vestuario",
    "Ripley": "Vestuario",
    # Educación
    "Colegio San Ignacio": "Educación",
    # Hogar (mejoramiento, ferretería)
    "Homecenter Sodimac": "Hogar",
}

# Mapeo de la taxonomía del banco → la de Velvet. Se usa como etiqueta DÉBIL
# cuando el comercio no está en GOLD_COMERCIO (un banco nuevo, un comercio que
# no conocemos) pero el banco igual mandó su categoría.
MAPA_BANCO = {
    "Alimentos": "Supermercado",
    "Restaurantes": "Delivery",
    "Entretenimiento": "Entretención",
    "Servicios": "Servicios",
    "Telecomunicaciones": "Servicios",
    "Vivienda": "Vivienda",
    "Transporte": "Transporte",
    "Vestuario": "Vestuario",
    "Salud": "Salud",
    "Educacion": "Educación",
    "Educación": "Educación",
    "Hogar": "Hogar",
}
