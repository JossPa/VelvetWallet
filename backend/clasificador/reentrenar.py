# -*- coding: utf-8 -*-
"""
Reentrenamiento con las correcciones del usuario (tarea E6: el auto-aprendizaje).

Cada vez que alguien corrige una categoría (en "Por revisar" o en el detalle del
movimiento), eso es un ejemplo etiquetado NUEVO y de la vida real: una glosa que
el sistema no supo. Reentrenar con ellos hace que el modelo mejore justo donde
falla.

    python -m clasificador.reentrenar          (desde backend/, usa DATABASE_URL)

Qué hace:
  1. Lee las correcciones (tabla `correccion`, tipo 'recategorizar'), SOLO de
     quienes tienen vigente el consentimiento "entrenamiento_modelos"
     (Ley 21.719: usar los gastos para entrenar es una finalidad distinta de
     mostrarlos, y necesita su propio permiso).
  2. Entrena DESDE CERO: dataset base + esas correcciones, con más peso a las
     reales que a las sintéticas. Como se parte de cero cada vez, si alguien
     revoca su consentimiento sus ejemplos salen del próximo modelo.
  3. Mide contra el test oculto y guarda solo si no empeoró (guardia de
     regresión).
  4. Si guardó, vuelve a clasificar los gastos que no corrigió nadie, para que
     el modelo nuevo se note en la app.
"""
from __future__ import annotations

import re
from pathlib import Path

from sklearn.metrics import accuracy_score

from .dataset import generar_dataset
from .modelo import UMBRAL_DEFECTO, ClasificadorGastos

AQUI = Path(__file__).resolve().parent
RUTA_MODELO = AQUI / "modelo.joblib"
FINALIDAD = "entrenamiento_modelos"

# Partes de una glosa que NO identifican al comercio: el intermediario del pago,
# números de local o de operación, ciudades.
_SIN_COMERCIO = re.compile(
    r"TRANSBANK|MERPAGO|MPAGO|PAGO|COMPRA|PSP|PAT|PAC|TEF|WEB|CARGO|VARIOS|NACIONAL|"
    r"\bCL\b|STGO|SANTIAGO|\d+|[^\w]+", re.I)


def tiene_comercio(glosa: str) -> bool:
    """
    False si la glosa no nombra a ningún comercio ("TRANSBANK*CL 7781").

    Una corrección sobre esas glosas sirve para ESE movimiento de ESA persona,
    pero no para entrenar: el modelo aprendería que todo lo que pasa por
    Transbank es, por ejemplo, "Seguros", y se lo aplicaría a todos.
    """
    return len(_SIN_COMERCIO.sub("", glosa or "")) >= 3


def reentrenar(
    correcciones: list[tuple[str, str]],
    peso_correccion: int = 5,
    umbral: float = UMBRAL_DEFECTO,
    guardar: bool = True,
) -> dict:
    """
    Reentrena incorporando las correcciones [(glosa, categoria)]. Devuelve un
    reporte con la exactitud antes/después sobre el test oculto. Si empeora, NO
    guarda.
    """
    base = generar_dataset("train")
    test = generar_dataset("test")
    gl_te, y_te = [g for g, _ in test], [c for _, c in test]

    # Las correcciones pesan más: se repiten `peso_correccion` veces. Así el
    # modelo aprende del caso real sin que lo tape el volumen sintético.
    extra = [(g, c) for (g, c) in correcciones for _ in range(peso_correccion)]
    datos = base + extra

    nuevo = ClasificadorGastos(umbral=umbral).entrenar(
        [g for g, _ in datos], [c for _, c in datos]
    )

    def exactitud(modelo):
        y = modelo.pipeline.predict(gl_te)
        return round(accuracy_score(y_te, y), 4)

    antes = None
    try:
        antes = exactitud(ClasificadorGastos.cargar(RUTA_MODELO))
    except Exception:  # noqa: BLE001 — no hay modelo, o es de otra versión
        pass
    despues = exactitud(nuevo)

    # Guardia de regresión: no reemplazar un modelo por uno peor.
    mejora = antes is None or despues >= antes - 0.01
    if guardar and mejora:
        nuevo.guardar(RUTA_MODELO)

    return {
        "n_correcciones": len(correcciones),
        "exactitud_antes": antes,
        "exactitud_despues": despues,
        "guardado": bool(guardar and mejora),
    }


def correcciones_consentidas(conn) -> list[tuple[str, str]]:
    """
    (glosa, categoría) de la ÚLTIMA corrección de cada movimiento, solo de
    usuarios con el consentimiento de entrenamiento vigente y sin vencer, y
    solo de glosas que nombran un comercio (ver tiene_comercio).
    """
    from api.privacidad import usuarios_que_consienten

    usuarios = usuarios_que_consienten(conn, FINALIDAD)
    if not usuarios:
        return []
    filas = conn.execute(
        """
        SELECT DISTINCT ON (co.transaccion_id) t.glosa_original, co.valor->>'categoria'
        FROM correccion co
        JOIN transaccion t ON t.id = co.transaccion_id
        WHERE co.tipo = 'recategorizar'
          AND co.usuario_id = ANY(%s::uuid[])
          AND t.glosa_original IS NOT NULL
        ORDER BY co.transaccion_id, co.created_at DESC
        """,
        (usuarios,),
    ).fetchall()
    return [(g, c) for g, c in filas if g and c and tiene_comercio(g)]


def reclasificar_todo(conn) -> int:
    """
    Vuelve a clasificar todos los gastos que NO corrigió el usuario, con el
    modelo actual. Devuelve cuántos cambiaron de categoría.
    """
    from ingesta.normalizador import categoria_propuesta
    from ingesta.repositorio import Repositorio

    repo = Repositorio.__new__(Repositorio)   # solo para reusar categoria_id()
    repo.conn, repo._categorias = conn, {}

    filas = conn.execute(
        """
        SELECT t.id, t.glosa_original, t.monto, t.categoria_id, t.confianza_clasificacion
        FROM transaccion t
        WHERE t.monto < 0
          AND NOT EXISTS (SELECT 1 FROM correccion co
                          WHERE co.transaccion_id = t.id AND co.tipo = 'recategorizar')
        """).fetchall()
    cambios = []
    for tid, glosa, monto, cat_id, confianza in filas:
        categoria, nueva_conf = categoria_propuesta(glosa, monto)
        nuevo_id = repo.categoria_id(categoria)
        if str(nuevo_id) != str(cat_id) or nueva_conf != (float(confianza) if confianza is not None else None):
            cambios.append((nuevo_id, nueva_conf, tid))
    if cambios:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE transaccion SET categoria_id = %s, confianza_clasificacion = %s "
                "WHERE id = %s", cambios)
    return len(cambios)


def main():
    import psycopg

    from ingesta import config
    from . import recargar

    with psycopg.connect(config.DATABASE_URL) as conn:
        correcciones = correcciones_consentidas(conn)
        print("Correcciones utilizables (con consentimiento vigente): %d" % len(correcciones))
        r = reentrenar(correcciones)
        print("Exactitud en el test oculto: antes %s · después %s" % (r["exactitud_antes"],
                                                                    r["exactitud_despues"]))
        if not r["guardado"]:
            print("El modelo nuevo no es mejor: se mantiene el anterior.")
            return
        recargar()
        cambiaron = reclasificar_todo(conn)
        print("Modelo nuevo guardado. Movimientos reclasificados: %d" % cambiaron)


if __name__ == "__main__":
    main()
