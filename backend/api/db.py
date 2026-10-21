# -*- coding: utf-8 -*-
"""
Conexión a PostgreSQL para el API.

Sale del pool compartido (ingesta/conexiones_bd.py): las conexiones se
reutilizan entre peticiones en vez de abrir una nueva a la nube cada vez.
Se usa igual que antes: `with conectar() as conn:` (commit al salir).
"""
from ingesta.conexiones_bd import conexion


def conectar(diccionarios: bool = False):
    return conexion(diccionarios=diccionarios)
