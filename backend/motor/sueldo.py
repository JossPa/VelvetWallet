# -*- coding: utf-8 -*-
"""
Detección del sueldo a partir de los abonos (RF-36).

El principio de producto es que el sueldo se configura UNA VEZ y no se vuelve a
tocar. Este motor permite ir un paso más allá: en vez de pedirle a la persona
que escriba su sueldo, se le propone el que ya se ve en su cuenta y ella solo
confirma. Escribir un monto es fricción evitable cuando el dato ya llegó.

Qué se considera sueldo: el abono que se repite con la MISMA glosa en varios
meses distintos. Un bono, una devolución o una transferencia puntual aparecen
una vez y no califican. Entre varios candidatos gana el que aparece en más
meses, y si empatan, el de monto mayor: entre un sueldo y un reembolso mensual
chico, el sueldo es el grande.

El monto que se devuelve es la MEDIANA, no el promedio: un mes con aguinaldo o
una liquidación con bono no deben inflar la cifra que se le propone al usuario.

Lo que este motor NO hace: decidir qué abonos son candidatos. Las
transferencias entre cuentas propias las filtra quien consulta, porque eso
depende de cómo cada institución las glosa.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date

from .recurrencias import clave_comercio

# Mínimo de meses distintos para aceptar un abono como sueldo. Es el mismo
# umbral que usa la proyección Monte Carlo: por debajo de tres observaciones
# no hay patrón, hay anécdota.
MINIMO_MESES = 3


@dataclass(frozen=True)
class Abono:
    fecha: date
    glosa: str
    monto: float


@dataclass(frozen=True)
class Sueldo:
    """Lo que se le propone al usuario, con de dónde salió."""
    monto: float
    #: La glosa tal como la escribe el banco, para que la persona la reconozca.
    glosa: str
    #: En cuántos meses distintos se vio. Es la fuerza de la evidencia.
    meses: int
    desde: date
    hasta: date


def detectar(abonos: list[Abono], minimo_meses: int = MINIMO_MESES) -> Sueldo | None:
    """
    El abono recurrente que mejor explica el ingreso mensual, o None.

    Devolver None es una respuesta válida y deliberada: sin evidencia
    suficiente no se propone nada y la persona escribe su sueldo a mano.
    Proponer un número débil sería peor que no proponer ninguno, porque
    después alimenta la proyección de metas.
    """
    grupos: dict[str, list[Abono]] = {}
    for a in abonos:
        if a.monto <= 0:
            continue
        grupos.setdefault(clave_comercio(a.glosa), []).append(a)

    mejor: Sueldo | None = None
    for candidatos in grupos.values():
        meses = {(a.fecha.year, a.fecha.month) for a in candidatos}
        if len(meses) < minimo_meses:
            continue
        fechas = [a.fecha for a in candidatos]
        propuesta = Sueldo(
            monto=float(statistics.median(a.monto for a in candidatos)),
            # La glosa más reciente: si el banco cambió el texto, se muestra el
            # que la persona vio la última vez.
            glosa=max(candidatos, key=lambda a: a.fecha).glosa,
            meses=len(meses),
            desde=min(fechas),
            hasta=max(fechas),
        )
        if mejor is None or (propuesta.meses, propuesta.monto) > (mejor.meses, mejor.monto):
            mejor = propuesta
    return mejor
