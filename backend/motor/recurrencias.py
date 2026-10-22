# -*- coding: utf-8 -*-
"""
Detección de gastos recurrentes y suscripciones (OE-4 / RF-20…RF-22).

El problema
-----------
Una persona no sabe cuánto se le va en cosas que paga todos los meses sin
mirar: la membresía del gimnasio, el streaming, la cuenta de la luz. No están
etiquetadas en ninguna parte; hay que deducirlas de la forma de los datos.

Lo que había antes era una heurística inline: si un comercio aparece una vez al
mes en cuatro meses distintos, es recurrente. Funciona para Netflix y falla con
todo lo demás, porque exige que la glosa sea idéntica, que el monto no importe
y que el cargo caiga siempre dentro del mismo mes calendario.

Las tres tolerancias que pide el objetivo
-----------------------------------------
**Glosa.** El mismo comercio llega escrito distinto cada vez, porque el banco
pega el número de local, la ciudad o el código de la transacción:
`UBER *EATS 8829 SANTIAGO` y `UBER *EATS 1142 PROVIDENCIA` son lo mismo. Se
agrupa por una clave que descarta dígitos y relleno.

**Fecha.** Un cobro "mensual" no cae el mismo número cada mes: los días 31 no
existen en febrero, los cobros se corren al día hábil siguiente y los meses no
duran lo mismo. Se trabaja con la distancia en días entre cobros y se acepta
una banda alrededor de cada periodicidad conocida.

**Monto.** Una suscripción sube de precio y una cuenta de servicios varía todos
los meses. Exigir el mismo monto dejaría fuera justamente las que más conviene
vigilar. Se usa la mediana como referencia y se admite una desviación; además
se informa si el último cobro se salió de esa banda, que es la señal de que
subió de precio.

Qué NO hace
-----------
No inventa. Con menos de `MINIMO_COBROS` cobros no hay cómo distinguir una
periodicidad de una coincidencia: dos cobros siempre definen un intervalo, y
llamarlo "mensual" sería describir el ruido. En ese caso no se reporta nada,
igual que el clasificador y el motor de proyección se abstienen.
"""
from __future__ import annotations

import re
import statistics
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta

# Con dos cobros hay un solo intervalo y cualquier número lo "explica". Tres es
# el mínimo para que la periodicidad sea una observación y no una suposición.
MINIMO_COBROS = 3

# Periodicidades reconocidas, con la banda de días que se acepta para cada una.
# Las bandas no son simétricas por capricho: un cobro mensual se atrasa al día
# hábil siguiente mucho más seguido de lo que se adelanta.
PERIODOS: list[tuple[str, int, int, int]] = [
    # (nombre,        días típicos, mínimo, máximo)
    ("semanal",        7,    6,   8),
    ("quincenal",     15,   13,  17),
    ("mensual",       30,   26,  35),
    ("bimestral",     60,   55,  66),
    ("trimestral",    91,   84,  98),
    ("anual",        365,  350, 380),
]

# Cuánto puede alejarse un cobro de la mediana para seguir contando como "el
# mismo cobro". Generoso a propósito: las cuentas de servicios varían de verdad.
TOLERANCIA_MONTO = 0.25

# Qué fracción de los cobros debe caer dentro de esa banda. Permite que una
# suscripción que subió de precio siga detectándose.
FRACCION_EN_BANDA = 0.6

# Si el último cobro es más viejo que esto (en periodos), la suscripción se da
# por terminada y no se ofrece como activa.
PERIODOS_PARA_DARLA_DE_BAJA = 2.5

# Palabras que el banco pega a la glosa y que no identifican al comercio.
_RELLENO = {
    "spa", "ltda", "sa", "eirl", "chile", "cl", "santiago", "providencia",
    "las", "condes", "puerto", "montt", "suc", "sucursal", "local", "tienda",
    "compra", "pago", "cargo", "web", "online", "com", "net",
}


def clave_comercio(glosa: str) -> str:
    """
    Reduce la glosa a lo que identifica al comercio.

    Quita tildes, signos, números de local y las palabras de relleno que el
    banco agrega. `UBER *EATS 8829 SANTIAGO` y `uber eats 1142 Providencia`
    caen en la misma clave.

    Las palabras se pegan sin separador porque el mismo comercio aparece
    escrito junto y separado según quién emita el cobro: `SMARTFIT` y
    `SMART FIT` son el mismo gimnasio, y con espacios quedarían en grupos
    distintos. Es el caso más común después de los números de local.
    """
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", glosa) if unicodedata.category(c) != "Mn"
    )
    palabras = re.findall(r"[a-z]+", sin_tildes.lower())
    utiles = [p for p in palabras if p not in _RELLENO and len(p) > 1]
    # Si al limpiar no queda nada (glosa puro número o puro relleno), se
    # conserva la original: es preferible no agrupar a agrupar cosas distintas.
    return "".join(utiles) if utiles else glosa.strip().lower()


@dataclass(frozen=True)
class Cobro:
    """Un cargo tal como lo necesita el detector. `id` vuelve en el resultado."""
    id: str
    fecha: date
    monto: float          # positivo: es un gasto
    glosa: str


@dataclass(frozen=True)
class Recurrencia:
    nombre: str
    clave: str
    periodicidad: str
    monto_esperado: float
    dias_entre_cobros: int
    primera_fecha: date
    ultima_fecha: date
    proxima_fecha_estimada: date
    cobros: int
    activa: bool
    # El último cobro se salió de la banda hacia arriba: subió de precio.
    subio_de_precio: bool
    monto_ultimo: float
    ids: tuple[str, ...] = field(default=())


def _periodicidad(dias: float) -> str | None:
    for nombre, _tipico, minimo, maximo in PERIODOS:
        if minimo <= dias <= maximo:
            return nombre
    return None


def _serie_regular(fechas: list[date]) -> tuple[str, int] | None:
    """
    Periodicidad de una serie de fechas, o None si no hay ninguna.

    Se usa la **mediana** de los intervalos y no el promedio: un cobro doble o
    un mes saltado desplazaría el promedio lo suficiente como para sacar la
    serie de su banda, mientras que la mediana lo absorbe.
    """
    if len(fechas) < MINIMO_COBROS:
        return None

    intervalos = [(b - a).days for a, b in zip(fechas, fechas[1:])]
    if any(d <= 0 for d in intervalos):
        return None

    mediana = statistics.median(intervalos)
    nombre = _periodicidad(mediana)
    if nombre is None:
        return None

    # La mayoría de los intervalos tiene que parecerse a la mediana. Si no, son
    # cobros sueltos que por casualidad promedian un mes (un supermercado al
    # que se va dos veces en marzo y ninguna en abril).
    parecidos = sum(1 for d in intervalos if _periodicidad(d) == nombre)
    if parecidos / len(intervalos) < FRACCION_EN_BANDA:
        return None

    return nombre, int(round(mediana))


def _montos_compatibles(montos: list[float]) -> tuple[bool, float]:
    """¿Son 'el mismo cobro'? Devuelve (sí/no, monto de referencia)."""
    referencia = statistics.median(montos)
    if referencia <= 0:
        return False, 0.0
    dentro = sum(1 for m in montos if abs(m - referencia) / referencia <= TOLERANCIA_MONTO)
    return dentro / len(montos) >= FRACCION_EN_BANDA, referencia


def detectar(cobros: list[Cobro], hoy: date | None = None) -> list[Recurrencia]:
    """
    Agrupa los cargos por comercio y devuelve los que forman una serie regular.

    El resultado va ordenado por monto esperado descendente: lo que más pesa en
    el bolsillo primero, que es el orden en que la persona quiere revisarlo.
    """
    hoy = hoy or date.today()

    grupos: dict[str, list[Cobro]] = {}
    for c in cobros:
        if c.monto <= 0 or not c.glosa:
            continue
        grupos.setdefault(clave_comercio(c.glosa), []).append(c)

    encontradas: list[Recurrencia] = []
    for clave, grupo in grupos.items():
        grupo = sorted(grupo, key=lambda c: c.fecha)
        if len(grupo) < MINIMO_COBROS:
            continue

        serie = _serie_regular([c.fecha for c in grupo])
        if serie is None:
            continue
        periodicidad, dias = serie

        montos = [c.monto for c in grupo]
        compatibles, referencia = _montos_compatibles(montos)
        if not compatibles:
            continue

        ultima = grupo[-1].fecha
        monto_ultimo = grupo[-1].monto

        encontradas.append(Recurrencia(
            # Se muestra la glosa más reciente, no la clave normalizada: la
            # persona reconoce "Spotify", no "spotify premium".
            nombre=grupo[-1].glosa,
            clave=clave,
            periodicidad=periodicidad,
            monto_esperado=round(referencia),
            dias_entre_cobros=dias,
            primera_fecha=grupo[0].fecha,
            ultima_fecha=ultima,
            proxima_fecha_estimada=ultima + timedelta(days=dias),
            cobros=len(grupo),
            activa=(hoy - ultima).days <= dias * PERIODOS_PARA_DARLA_DE_BAJA,
            subio_de_precio=(monto_ultimo - referencia) / referencia > TOLERANCIA_MONTO,
            monto_ultimo=round(monto_ultimo),
            ids=tuple(c.id for c in grupo),
        ))

    return sorted(encontradas, key=lambda r: r.monto_esperado, reverse=True)


def gasto_fijo_mensual(recurrencias: list[Recurrencia]) -> float:
    """
    Cuánto se va al mes en lo recurrente activo, llevando todo a base mensual.

    Sirve para responder "¿cuánto tengo comprometido antes de gastar nada?",
    que es la lectura útil de tener las suscripciones detectadas.
    """
    total = 0.0
    for r in recurrencias:
        if r.activa and r.dias_entre_cobros > 0:
            total += r.monto_esperado * (30 / r.dias_entre_cobros)
    return round(total)
