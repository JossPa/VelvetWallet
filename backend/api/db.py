# -*- coding: utf-8 -*-
"""Conexión a PostgreSQL (una por petición; simple y suficiente para el proyecto)."""
import psycopg

from . import config


def conectar() -> psycopg.Connection:
    return psycopg.connect(config.DATABASE_URL)
