# -*- coding: utf-8 -*-
"""
Registrar una brecha de seguridad y notificar a los afectados (Ley 21.719).

Lo corre el **Delegado de Protección de Datos**, no el usuario. Declarar una
brecha tiene consecuencias legales y no es una operación de la aplicación: por
eso vive como procedimiento explícito y no como un endpoint.

El plazo de 72 horas empieza a correr con el registro, así que este script es
también el que deja constancia de cuándo se tomó conocimiento.

Uso, desde backend/:

    python registrar_incidente.py \\
        --titulo "Acceso no autorizado al servidor de sincronización" \\
        --descripcion "Un tercero accedió durante 40 minutos a ..." \\
        --datos "Glosas y montos de movimientos; ningún dato bancario de acceso" \\
        --medidas "Se revocaron los tokens y se forzó reautenticación" \\
        --gravedad alta \\
        --todos

Para afectar solo a algunas personas, en vez de --todos:

        --correos ana@ejemplo.cl,juan@ejemplo.cl

Sin --confirmar solo muestra qué haría, sin escribir nada.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row

from api import config
from motor.brechas import describir, plazo_de


def main() -> int:
    p = argparse.ArgumentParser(description="Registra una brecha y avisa a los titulares afectados.")
    p.add_argument("--titulo", required=True)
    p.add_argument("--descripcion", required=True,
                   help="Qué pasó, en lenguaje para el titular.")
    p.add_argument("--datos", required=True,
                   help="Qué categorías de datos se vieron afectadas.")
    p.add_argument("--medidas", default=None, help="Qué se hizo para contenerlo.")
    p.add_argument("--gravedad", default="media", choices=["baja", "media", "alta"])
    p.add_argument("--ocurrido", default=None,
                   help="Cuándo pasó (ISO), si se sabe. Distinto de cuándo se detectó.")
    grupo = p.add_mutually_exclusive_group(required=True)
    grupo.add_argument("--todos", action="store_true", help="Afecta a todas las cuentas.")
    grupo.add_argument("--correos", help="Lista separada por comas.")
    p.add_argument("--confirmar", action="store_true",
                   help="Sin esto, solo muestra qué haría.")
    a = p.parse_args()

    with psycopg.connect(config.DATABASE_URL, row_factory=dict_row) as conn:
        if a.todos:
            afectados = conn.execute("SELECT id, email FROM usuario ORDER BY email").fetchall()
        else:
            correos = [c.strip().lower() for c in a.correos.split(",") if c.strip()]
            afectados = conn.execute(
                "SELECT id, email FROM usuario WHERE lower(email) = ANY(%s) ORDER BY email",
                (correos,),
            ).fetchall()
            faltan = set(correos) - {f["email"].lower() for f in afectados}
            if faltan:
                print("No existen estas cuentas:", ", ".join(sorted(faltan)), file=sys.stderr)
                return 1

        if not afectados:
            print("No hay titulares afectados. Nada que registrar.", file=sys.stderr)
            return 1

        ahora = datetime.now(timezone.utc)
        plazo = plazo_de(ahora, ahora=ahora)

        print(f"Incidente : {a.titulo}")
        print(f"Gravedad  : {a.gravedad}")
        print(f"Datos     : {a.datos}")
        print(f"Afectados : {len(afectados)} titulares")
        print(f"Plazo     : vence el {plazo.vence_at:%d-%m-%Y %H:%M} UTC ({describir(plazo)})")

        if not a.confirmar:
            print("\nSimulación. Agrega --confirmar para registrarlo de verdad.")
            return 0

        fila = conn.execute(
            """INSERT INTO incidente_seguridad
                   (titulo, descripcion, datos_afectados, medidas, gravedad,
                    ocurrido_at, detectado_at, estado, notificado_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'notificado', now())
               RETURNING id""",
            (a.titulo, a.descripcion, a.datos, a.medidas, a.gravedad,
             a.ocurrido, ahora),
        ).fetchone()

        conn.execute(
            "INSERT INTO incidente_afectado (incidente_id, usuario_id) "
            "SELECT %s, unnest(%s::uuid[])",
            (fila["id"], [f["id"] for f in afectados]),
        )
        conn.commit()

    print(f"\nRegistrado: {fila['id']}")
    print("Los afectados lo verán en la aplicación la próxima vez que entren.")
    print("Pendiente aparte: notificar a la autoridad de protección de datos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
