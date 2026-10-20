# -*- coding: utf-8 -*-
"""
Motor de proyección de metas de ahorro — simulación de Monte Carlo (RF-24).

El problema
-----------
La v1 respondía "¿cuándo puedo comprarlo?" con una división:

    meses = (objetivo - ahorrado) / excedente_mensual

Esa cuenta asume que todos los meses sobra lo mismo, y eso no pasa nunca. Fue
una de las tres limitaciones que dejó en evidencia el uso real de la v1, y es
la que justifica este motor.

El enfoque
----------
En vez de un número inventado de excedente mensual, se usan los excedentes que
la persona **realmente tuvo**, y se simulan miles de futuros posibles armados
con esos meses en distinto orden. De ahí sale una respuesta con probabilidad:

    "en 4 meses con 80% de probabilidad, en 6 con 95%"

Tres decisiones que vale la pena poder defender:

1. **Remuestreo (bootstrap), no una distribución teórica.** Con cinco o seis
   meses observados no hay cómo justificar que el excedente sea normal, ni
   ninguna otra forma. Remuestrear los meses realmente ocurridos no asume
   ninguna forma: usa la que haya.

2. **El orden importa, no solo el promedio.** Un mes malo temprano puede
   impedir que se alcance la meta aunque el promedio diga que sí. Simular mes a
   mes captura eso; dividir por el promedio lo esconde.

3. **Generador sembrado.** La misma entrada da siempre la misma salida, así que
   el motor es verificable con pruebas unitarias. Una simulación que no se
   puede reproducir no se puede probar.

Y una limitación declarada: si no hay al menos `MINIMO_MESES` meses completos
observados, el motor **no proyecta**. Remuestrear uno o dos meses devolvería
siempre esos mismos números y daría una falsa sensación de certeza. Es el mismo
criterio de abstención que aplica el clasificador (RNF-33): antes de inventar,
decir que no se sabe.
"""
from dataclasses import dataclass
from typing import Mapping, Sequence

import numpy as np

# Mínimo de meses completos para que el remuestreo signifique algo. Con menos,
# la simulación solo repetiría los mismos uno o dos valores.
MINIMO_MESES = 3

# Hasta dónde se mira hacia adelante. Más allá de dos años la proyección deja
# de ser útil: cambia el sueldo, cambia la vida.
HORIZONTE_MESES = 24

# Cuántos futuros se simulan. 10.000 deja el error de muestreo bajo el 1%, que
# es mucho menos que la incertidumbre de tener solo unos meses de historial.
SIMULACIONES = 10_000

SEMILLA = 42


@dataclass(frozen=True)
class Proyeccion:
    """
    Resultado de proyectar una meta.

    `estado` dice qué puede mostrar la app, y es lo primero que hay que mirar:
    en todos los estados salvo "proyectada" los meses vienen en None.

      cumplida      → ya hay con qué: el ahorro llegó al objetivo.
      sin_historial → faltan meses observados; no se proyecta (abstención).
      improbable    → se simuló, pero ni la mitad de los futuros llega dentro
                      del horizonte. A este ritmo, no.
      proyectada    → hay respuesta con probabilidad.
    """

    estado: str
    meses_observados: int
    excedente_mediano: float
    excedente_peor: float
    excedente_mejor: float
    # curva[i] = probabilidad de haber alcanzado la meta en el mes i+1.
    # Es acumulada y por lo tanto no decreciente.
    curva: tuple[float, ...]
    # Meses necesarios para alcanzar la meta con esa probabilidad.
    # None = no se alcanza dentro del horizonte.
    meses_p50: int | None
    meses_p80: int | None
    meses_p95: int | None
    simulaciones: int
    horizonte_meses: int


def excedentes_observados(
    gasto_por_mes: Mapping[str, float],
    ingreso_mensual: float,
    mes_en_curso: str,
) -> list[float]:
    """
    Excedente de cada mes completo: lo que entra menos lo que se gastó.

    El mes en curso queda **fuera** a propósito. Va a medias, así que su gasto
    siempre parece más bajo y su excedente más alto; incluirlo inclinaría toda
    la proyección hacia el optimismo justo en el dato más reciente, que es el
    que más pesa en la intuición de la persona.

    Se devuelven en orden de mes para que el resultado sea estable y las
    pruebas, reproducibles.
    """
    return [
        ingreso_mensual - gasto
        for mes, gasto in sorted(gasto_por_mes.items())
        if mes != mes_en_curso
    ]


def _primer_mes_con(curva: np.ndarray, probabilidad: float) -> int | None:
    """Primer mes (base 1) en que la curva alcanza esa probabilidad."""
    alcanza = np.flatnonzero(curva >= probabilidad)
    return int(alcanza[0]) + 1 if alcanza.size else None


def proyectar(
    excedentes: Sequence[float],
    ahorro_actual: float,
    objetivo: float,
    horizonte_meses: int = HORIZONTE_MESES,
    simulaciones: int = SIMULACIONES,
    semilla: int = SEMILLA,
) -> Proyeccion:
    """
    Simula `simulaciones` futuros posibles y devuelve con qué probabilidad se
    alcanza `objetivo` en cada mes.

    Cada futuro se arma tomando al azar, mes a mes, uno de los excedentes ya
    observados (con reemplazo). El saldo se acumula y nunca baja de cero: un
    mes malo se come parte del ahorro, pero no se puede deber ahorro.
    """
    observados = [float(e) for e in excedentes]
    resumen = {
        "meses_observados": len(observados),
        "excedente_mediano": float(np.median(observados)) if observados else 0.0,
        "excedente_peor": min(observados) if observados else 0.0,
        "excedente_mejor": max(observados) if observados else 0.0,
        "simulaciones": simulaciones,
        "horizonte_meses": horizonte_meses,
    }
    vacia = {"curva": (), "meses_p50": None, "meses_p80": None, "meses_p95": None}

    # Ya está: no hay nada que proyectar.
    if ahorro_actual >= objetivo:
        return Proyeccion(estado="cumplida", **resumen, **vacia)

    # Abstención: con tan pocos meses, cualquier número sería fingido.
    if len(observados) < MINIMO_MESES:
        return Proyeccion(estado="sin_historial", **resumen, **vacia)

    rng = np.random.default_rng(semilla)
    muestras = rng.choice(np.asarray(observados), size=(simulaciones, horizonte_meses))

    # Saldo mes a mes. El bucle es sobre los meses (24), no sobre las
    # simulaciones (10.000): cada paso avanza las 10.000 a la vez.
    saldos = np.empty((simulaciones, horizonte_meses))
    saldo = np.full(simulaciones, float(ahorro_actual))
    for mes in range(horizonte_meses):
        saldo = np.maximum(0.0, saldo + muestras[:, mes])
        saldos[:, mes] = saldo

    # "Alcanzada" es haber tocado el objetivo alguna vez, no seguir sobre él:
    # el día que se alcanza, se compra. De ahí el máximo acumulado.
    alcanzada = np.maximum.accumulate(saldos, axis=1) >= objetivo
    curva = alcanzada.mean(axis=0)

    p50 = _primer_mes_con(curva, 0.50)
    estado = "proyectada" if p50 is not None else "improbable"

    return Proyeccion(
        estado=estado,
        **resumen,
        curva=tuple(round(float(p), 4) for p in curva),
        meses_p50=p50,
        meses_p80=_primer_mes_con(curva, 0.80),
        meses_p95=_primer_mes_con(curva, 0.95),
    )
