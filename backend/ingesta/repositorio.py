# -*- coding: utf-8 -*-
"""
Escritura en las dos bases.

  · MongoDB   → el payload crudo, tal como llegó, sin tocar (RF-06 / trazabilidad).
  · PostgreSQL → el dato normalizado, con UPSERT por id_externo.

El UPSERT es la pieza clave: en cada sincronización, si el movimiento ya existe
(mismo cuenta_id + id_externo) se ACTUALIZA; si no, se INSERTA. Eso es lo que
hace que una compra que pasa de pendiente a confirmada (mismo transactionID,
otro monto) se actualice en vez de duplicarse.

Las operaciones vienen en versión "una por una" y en versión "en lote" (bulk).
La ingesta usa las de lote: escribir los cientos de movimientos de un viaje en
pocas idas y vueltas a la nube, en vez de una por movimiento, es la diferencia
entre segundos y más de un minuto.
"""
from __future__ import annotations

from datetime import datetime

import psycopg
from psycopg.types.json import Json
from pymongo import MongoClient

from . import config

# Columnas de transaccion que escribe la ingesta, en orden fijo.
_COLS_TX = ["cuenta_id", "id_externo", "payload_crudo_ref", "monto", "moneda",
           "fecha", "glosa_original", "categoria_origen", "categoria_id",
           "confianza_clasificacion", "hash_dedup", "estado"]

# Un movimiento que el usuario recategorizó: su categoría es la de él, y ni una
# re-sincronización ni un modelo nuevo la pisan.
_CORREGIDO = ("EXISTS (SELECT 1 FROM correccion co WHERE co.transaccion_id = transaccion.id"
              " AND co.tipo = 'recategorizar')")

# Bases creadas antes de la columna categoria_origen (el DDL de init solo corre
# con la base vacía): se agrega una vez por proceso, sin tocar lo que ya hay.
_ESQUEMA_AL_DIA = False


def _asegurar_esquema(conn) -> None:
    global _ESQUEMA_AL_DIA
    if _ESQUEMA_AL_DIA:
        return
    conn.execute("ALTER TABLE transaccion ADD COLUMN IF NOT EXISTS categoria_origen varchar(80)")
    conn.commit()
    _ESQUEMA_AL_DIA = True


class Repositorio:
    def __init__(self):
        self.conn = psycopg.connect(config.DATABASE_URL)
        _asegurar_esquema(self.conn)
        self._categorias: dict[str, str] = {}   # nombre → categoria_id (cache)
        self._mongo = MongoClient(config.MONGO_URL)
        self.db = self._mongo[config.MONGO_DB]

    # ── MongoDB: crudo intacto ──────────────────────────────────────────────
    def guardar_crudo(self, conexion_id: str, endpoint: str, payload: dict) -> str:
        """Guarda un movimiento crudo y devuelve el ObjectId (24 hex) para la FK."""
        doc = {
            "conexion_id": str(conexion_id),
            "endpoint_origen": endpoint,
            "payload": payload,
            "procesado": True,
            "recibido_at": datetime.utcnow(),
        }
        return str(self.db.payload_crudo.insert_one(doc).inserted_id)

    def guardar_crudo_bulk(self, conexion_id: str, endpoint: str,
                           payloads: list[dict]) -> list[str]:
        """
        Guarda muchos movimientos crudos en UNA sola operación (insert_many) y
        devuelve sus ObjectId (como texto), en el mismo orden.
        """
        if not payloads:
            return []
        ahora = datetime.utcnow()
        docs = [
            {
                "conexion_id": str(conexion_id),
                "endpoint_origen": endpoint,
                "payload": p,
                "procesado": True,
                "recibido_at": ahora,
            }
            for p in payloads
        ]
        res = self.db.payload_crudo.insert_many(docs)
        return [str(_id) for _id in res.inserted_ids]

    # ── PostgreSQL: consentimiento ──────────────────────────────────────────
    def registrar_consentimiento(self, conexion_id: str, alcance_rar: dict,
                                 fecha_expiracion) -> str:
        """
        Deja registrado el consentimiento vigente de la conexión (RF-02 / RF-27).
        Si ya hay uno vigente, lo refresca; si no, lo crea.
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

    def consentimiento_vigente(self, conexion_id: str) -> dict | None:
        """
        El alcance (alcance_rar) del consentimiento vigente de la conexión, o
        None si no hay. Ahí queda a qué cliente del banco corresponde la
        conexión (rutCliente) y el refresh token para renovar el acceso.
        """
        fila = self.conn.execute(
            """SELECT alcance_rar FROM consentimiento
               WHERE conexion_id = %s AND estado = 'vigente'
               ORDER BY fecha_inicio DESC LIMIT 1""",
            (conexion_id,),
        ).fetchone()
        return fila[0] if fila else None

    def eliminar_conexion(self, conexion_id: str) -> None:
        """
        Desvincula un banco: borra la conexión y, en cascada, sus cuentas,
        consentimientos, movimientos y correcciones (FK ON DELETE CASCADE).
        También borra los payloads crudos de Mongo: si el usuario retira el
        permiso, sus datos no se quedan guardados (Ley 21.719).
        """
        self.db.payload_crudo.delete_many({"conexion_id": str(conexion_id)})
        self.conn.execute("DELETE FROM conexion WHERE id = %s", (conexion_id,))

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

    # ── PostgreSQL: upsert de transacciones (en lote) ───────────────────────
    # ── PostgreSQL: categorías ──────────────────────────────────────────────
    def categoria_id(self, nombre: str | None) -> str | None:
        """
        id de la categoría de gasto con ese nombre; la crea si no existe (así
        funciona sobre una base sin el catálogo cargado). None si no hay nombre:
        el clasificador se abstuvo y categoria_id queda NULL.
        """
        if not nombre:
            return None
        if nombre not in self._categorias:
            fila = self.conn.execute(
                "SELECT id FROM categoria WHERE nombre = %s AND tipo = 'gasto' "
                "ORDER BY id LIMIT 1", (nombre,)).fetchone()
            if fila is None:
                fila = self.conn.execute(
                    "INSERT INTO categoria (nombre, tipo) VALUES (%s, 'gasto') RETURNING id",
                    (nombre,)).fetchone()
            self._categorias[nombre] = fila[0]
        return self._categorias[nombre]

    def upsert_transacciones_bulk(self, cuenta_id: str, refs: list[str],
                                  datos_list: list[dict]) -> dict:
        """
        Inserta/actualiza MUCHOS movimientos en UNA sola sentencia. Devuelve
        cuántos fueron nuevos, cuántos actualizados y cuántos llegaron igual.

          nuevo       → no existía y se insertó.
          actualizado → ya existía y el banco lo mandó distinto (p. ej. una
                        compra que pasó de pendiente a confirmada).
          sin cambio  → ya existía exactamente igual; no se tocó.

        El WHERE del DO UPDATE distingue los dos últimos: sin él, el UPDATE se
        dispara en cada sincronización para TODOS los existentes y el conteo
        diría que se actualizaron cientos cuando cambiaron tres. IS DISTINCT FROM
        (en vez de <>) compara bien contra NULL.

        La categoría que propone el clasificador se guarda al insertar. Al
        actualizar se recalcula, salvo que el usuario la haya corregido.
        """
        if not datos_list:
            return {"insertadas": 0, "actualizadas": 0, "sin_cambio": 0}

        marcador = "(" + ",".join(["%s"] * len(_COLS_TX)) + ")"
        marcadores = ",".join([marcador] * len(datos_list))
        params: list = []
        for ref, d in zip(refs, datos_list):
            params.extend([
                cuenta_id, d["id_externo"], ref, d["monto"], d["moneda"],
                d["fecha"], d["glosa_original"], d["categoria_origen"],
                self.categoria_id(d.get("categoria_nombre")),
                d.get("confianza_clasificacion"), d["hash_dedup"], d["estado"],
            ])

        sql = (
            "INSERT INTO transaccion (" + ", ".join(_COLS_TX) + ") VALUES "
            + marcadores
            + " ON CONFLICT (cuenta_id, id_externo) WHERE id_externo IS NOT NULL"
            + " DO UPDATE SET monto = EXCLUDED.monto,"
            + "               hash_dedup = EXCLUDED.hash_dedup,"
            + "               payload_crudo_ref = EXCLUDED.payload_crudo_ref,"
            + "               glosa_original = EXCLUDED.glosa_original,"
            + "               categoria_origen = EXCLUDED.categoria_origen,"
            + "               categoria_id = CASE WHEN " + _CORREGIDO
            + "                   THEN transaccion.categoria_id ELSE EXCLUDED.categoria_id END,"
            + "               confianza_clasificacion = CASE WHEN " + _CORREGIDO
            + "                   THEN transaccion.confianza_clasificacion"
            + "                   ELSE EXCLUDED.confianza_clasificacion END"
            + " WHERE transaccion.monto            IS DISTINCT FROM EXCLUDED.monto"
            + "    OR transaccion.glosa_original   IS DISTINCT FROM EXCLUDED.glosa_original"
            + "    OR transaccion.categoria_origen IS DISTINCT FROM EXCLUDED.categoria_origen"
            + " RETURNING (xmax = 0) AS insertado"
        )
        filas = self.conn.execute(sql, params).fetchall()
        insertadas = sum(1 for f in filas if f[0])
        return {"insertadas": insertadas, "actualizadas": len(filas) - insertadas,
                "sin_cambio": len(datos_list) - len(filas)}

    def clasificar_sin_categoria(self, conexion_id: str, clasificar) -> int:
        """
        Pasa por el clasificador los gastos de la conexión que siguen sin
        categoría (llegaron antes de que existiera, o el modelo mejoró desde
        entonces). No toca los que corrigió el usuario. Devuelve cuántos
        quedaron clasificados.

        `clasificar(glosa, monto) -> (categoria, confianza)`.
        """
        filas = self.conn.execute(
            """
            SELECT t.id, t.glosa_original, t.monto
            FROM transaccion t JOIN cuenta c ON c.id = t.cuenta_id
            WHERE c.conexion_id = %s AND t.categoria_id IS NULL AND t.monto < 0
              AND NOT EXISTS (SELECT 1 FROM correccion co
                              WHERE co.transaccion_id = t.id AND co.tipo = 'recategorizar')
            """, (conexion_id,)).fetchall()
        cambios = []
        for tid, glosa, monto in filas:
            categoria, confianza = clasificar(glosa, monto)
            if categoria:
                cambios.append((self.categoria_id(categoria), confianza, tid))
        if cambios:
            with self.conn.cursor() as cur:
                cur.executemany(
                    "UPDATE transaccion SET categoria_id = %s, confianza_clasificacion = %s "
                    "WHERE id = %s", cambios)
        return len(cambios)

    def marcar_recurrentes(self, usuario_id: str, glosas_recurrentes: list[str]):
        """
        Marca es_recurrente=true en los movimientos del usuario cuyo comercio
        está en `glosas_recurrentes` (las membresías/servicios detectados por
        frecuencia), y false en el resto. El detector vive en el orquestador
        (sincronizar.py); aquí solo se persiste el resultado.
        """
        self.conn.execute(
            """
            UPDATE transaccion t
            SET es_recurrente = (t.glosa_original = ANY(%(glosas)s))
            FROM cuenta c
            WHERE t.cuenta_id = c.id AND c.usuario_id = %(uid)s
            """,
            {"glosas": list(glosas_recurrentes), "uid": usuario_id},
        )

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
