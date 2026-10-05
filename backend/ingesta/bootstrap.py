# -*- coding: utf-8 -*-
"""
Siembra idempotente de la identidad mínima que las claves foráneas exigen.

Una transacción necesita una cuenta; una cuenta, una conexión; una conexión,
un usuario y una institución. En producción todo eso nace del registro y del
consentimiento OAuth. Mientras esa parte no existe, aquí se crea una vez y se
reutiliza en cada corrida (no duplica).
"""
from __future__ import annotations

import psycopg

from . import config


def asegurar_identidad(conn: psycopg.Connection) -> tuple[str, str]:
    """
    Garantiza que existan usuario + institución + conexión, y devuelve
    (usuario_id, conexion_id): ambos los necesita la tabla cuenta.
    """
    # -- usuario (clave natural: email, que es UNIQUE) -----------------------
    fila = conn.execute(
        "SELECT id FROM usuario WHERE email = %s", (config.USUARIO_EMAIL,)
    ).fetchone()
    if fila:
        usuario_id = fila[0]
    else:
        usuario_id = conn.execute(
            """INSERT INTO usuario (email, nombre, hash_password)
               VALUES (%s, %s, %s) RETURNING id""",
            (config.USUARIO_EMAIL, config.USUARIO_NOMBRE, "demo-no-usar"),
        ).fetchone()[0]

    # -- institución (sin clave única en el esquema: get-or-create por nombre) --
    fila = conn.execute(
        "SELECT id FROM institucion WHERE nombre = %s", (config.INSTITUCION_NOMBRE,)
    ).fetchone()
    if fila:
        institucion_id = fila[0]
    else:
        institucion_id = conn.execute(
            """INSERT INTO institucion (nombre, tipo, participante_sfa)
               VALUES (%s, 'banco', true) RETURNING id""",
            (config.INSTITUCION_NOMBRE,),
        ).fetchone()[0]

    # -- conexión (get-or-create por el par usuario+institución) -------------
    fila = conn.execute(
        """SELECT id FROM conexion
           WHERE usuario_id = %s AND institucion_id = %s""",
        (usuario_id, institucion_id),
    ).fetchone()
    if fila:
        conexion_id = fila[0]
    else:
        conexion_id = conn.execute(
            """INSERT INTO conexion (usuario_id, institucion_id, estado)
               VALUES (%s, %s, 'activa') RETURNING id""",
            (usuario_id, institucion_id),
        ).fetchone()[0]

    return usuario_id, conexion_id
