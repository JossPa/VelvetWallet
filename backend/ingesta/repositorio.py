# -*- coding: utf-8 -*-
"""
Escritura en las dos bases.

  · MongoDB   → el payload crudo, tal como llegó, sin tocar (RF-06 / trazabilidad).
  · PostgreSQL → el dato normalizado, con UPSERT por id_externo.

El UPSERT es la pieza clave: en cada sincronización, si el movimiento ya existe
(mismo cuenta_id + id_externo) se ACTUALIZA; si no, se INSERTA. Eso es lo que
hace que una compra que pasa de pendiente a confirmada (mismo transactionID,
otro monto) se actualice en vez de duplicarse.
"""
from __future__ import annotations

import psycopg
from psycopg.types.json import Json
from pymongo import MongoClient

from . import config


class Repositorio:
    def __init__(self):
        self.conn = psycopg.connect(config.DATABASE_URL)
        self._mongo = MongoClient(config.MONGO_URL)
        self.db = self._mongo[config.MONGO_DB]

    # ── MongoDB: crudo intacto ──────────────────────────────────────────────
    def guardar_crudo(self, conexion_id: str, endpoint: str, payload: dict) -> str:
        """Guarda el movimiento crudo y devuelve el ObjectId (24 hex) para la FK."""
        doc = {
            "conexion_id": str(conexion_id),
            "endpoint_origen": endpoint,
            "payload": payload,
            "procesado": True,        # lo procesamos en la misma corrida
            "recibido_at": __import__("datetime").datetime.utcnow(),
        }
        return str(self.db.payload_crudo.insert_one(doc).inserted_id)

    # ── PostgreSQL: consentimiento ──────────────────────────────────────────
    def registrar_consentimiento(self, conexion_id: str, alcance_rar: dict,
                                 fecha_expiracion) -> str:
        """
        Deja registrado el consentimiento vigente de la conexión (RF-02 / RF-27).
        Si ya hay uno vigente, lo refresca; si no, lo crea. Así correr la ingesta
        varias veces no apila consentimientos duplicados.
        """
        fila = self.conn.execute(
            "SELECT id FROM consentimiento WHERE conexion_id = %s AND estado = 'vigente'",
            (conexion_id,),
        ).fetchone()
        if fila:
            self.conn.execute(
                """UPDATE consentimiento
                   SET alcance_rar = %s, fecha_expiracion = %s
                   WHERE id = %s""",
                (Json(alcance_rar), fecha_expiracion, fila[0]),
            )
            return fila[0]

        fila = self.conn.execute(
            """INSERT INTO consentimiento (conexion_id, alcance_rar, fecha_expiracion)
               VALUES (%s, %s, %s) RETURNING id""",
            (conexion_id, Json(alcance_rar), fecha_expiracion),
        ).fetchone()
        return fila[0]

    # ── PostgreSQL: upsert de cuenta ────────────────────────────────────────
    def upsert_cuenta(self, conexion_id: str, usuario_id: str, datos: dict) -> str:
        fila = self.conn.execute(
            """
            INSERT INTO cuenta (conexion_id, usuario_id, id_externo, tipo,
                                moneda, saldo, actualizado_at)
            VALUES (%(conexion_id)s, %(usuario_id)s, %(id_externo)s, %(tipo)s,
                    %(moneda)s, %(saldo)s, now())
            ON CONFLICT (conexion_id, id_externo) WHERE id_externo IS NOT NULL
            DO UPDATE SET saldo          = EXCLUDED.saldo,
                          moneda         = EXCLUDED.moneda,
                          tipo           = EXCLUDED.tipo,
                          actualizado_at = now()
            RETURNING id
            """,
            {"conexion_id": conexion_id, "usuario_id": usuario_id, **datos},
        ).fetchone()
        return fila[0]

    # ── PostgreSQL: upsert de transacción ───────────────────────────────────
    def upsert_transaccion(self, cuenta_id: str, payload_crudo_ref: str,
                           datos: dict) -> str:
        """
        Devuelve qué pasó con el movimiento:

          'nuevo'      → no existía y se insertó.
          'actualizado'→ ya existía y el banco lo mandó distinto (p. ej. una
                         compra que pasó de pendiente a confirmada).
          'sin_cambio' → ya existía exactamente igual; no se tocó.

        El `WHERE` del DO UPDATE es lo que distingue los dos últimos. Sin él, el
        UPDATE se dispara en cada sincronización para TODOS los movimientos
        existentes, y el conteo diría que se actualizaron cientos cuando en
        realidad cambiaron tres. Además evita reescribir filas sin motivo.

        IS DISTINCT FROM (en vez de <>) porque compara bien contra NULL: una
        glosa o una categoría que estaban vacías y siguen vacías no cuentan
        como cambio.
        """
        fila = self.conn.execute(
            """
            INSERT INTO transaccion (cuenta_id, id_externo, payload_crudo_ref,
                                     monto, moneda, fecha, glosa_original,
                                     categoria_origen, hash_dedup, estado)
            VALUES (%(cuenta_id)s, %(id_externo)s, %(ref)s, %(monto)s, %(moneda)s,
                    %(fecha)s, %(glosa_original)s, %(categoria_origen)s,
                    %(hash_dedup)s, %(estado)s)
            ON CONFLICT (cuenta_id, id_externo) WHERE id_externo IS NOT NULL
            DO UPDATE SET monto             = EXCLUDED.monto,
                          hash_dedup        = EXCLUDED.hash_dedup,
                          payload_crudo_ref = EXCLUDED.payload_crudo_ref,
                          glosa_original    = EXCLUDED.glosa_original,
                          categoria_origen  = EXCLUDED.categoria_origen
            WHERE transaccion.monto            IS DISTINCT FROM EXCLUDED.monto
               OR transaccion.glosa_original   IS DISTINCT FROM EXCLUDED.glosa_original
               OR transaccion.categoria_origen IS DISTINCT FROM EXCLUDED.categoria_origen
            RETURNING (xmax = 0) AS insertado
            """,
            {"cuenta_id": cuenta_id, "ref": payload_crudo_ref, **datos},
        ).fetchone()

        # Sin fila: el WHERE no se cumplió, o sea el movimiento llegó igual.
        if fila is None:
            return "sin_cambio"
        return "nuevo" if fila[0] else "actualizado"

    def marcar_sincronizacion(self, conexion_id: str):
        self.conn.execute(
            "UPDATE conexion SET ultima_sincronizacion = now() WHERE id = %s",
            (conexion_id,),
        )

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()
        self._mongo.close()
