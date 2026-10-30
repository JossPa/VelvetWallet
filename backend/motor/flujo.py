# -*- coding: utf-8 -*-
"""
Excedente mensual real y flujo de caja hasta el día de pago (RF-23, RF-25).

Son dos preguntas distintas y la app las confundía en una sola cifra:

  · El EXCEDENTE es estructural: de lo que entra cada mes, cuánto queda después
    de lo que ya está comprometido —gastos fijos y cuotas—. Responde "¿cuánto
    tengo para vivir este mes?" y no cambia de un día para otro.

  · La HOLGURA es de caja: del saldo que hay AHORA, cuánto sobra después de los
    cargos que vienen antes del próximo sueldo. Responde "¿me alcanza hasta el
    día de pago?" y cambia todos los días.

Las dos son necesarias. Un excedente sano con la holgura en rojo es el caso
clásico de fin de mes: la plata del mes alcanzaba, pero ya se gastó.

Decisiones que vale la pena poder defender:

  · El gasto futuro se parte en dos y no se mezcla: lo fijo entra como
    compromisos con su fecha, y lo variable se estima con la MEDIANA del gasto
    diario —no el promedio, porque un mes con una compra grande no debe hacer
    creer que todos los días se gastan $40.000—.
  · Un compromiso cuya fecha ya pasó en este ciclo no se vuelve a contar. Si la
    cuota se cobró el 5 y hoy es 12, descontarla otra vez sería contarla dos
    veces, porque ya está reflejada en el saldo.
  · Si no se sabe cuándo llega el sueldo, no se inventa: se devuelve None y la
    app dice que no puede proyectar todavía. Una fecha inventada aquí se
    convierte en un "te alcanza" que no es verdad.
"""
from __future__ import annotations

import calendar
import statistics
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class Compromiso:
    """Un cargo conocido que todavía no ocurre: una cuota o un gasto fijo."""
    nombre: str
    monto: float
    #: Cuándo se espera. Si no se sabe, no se puede ubicar en el ciclo.
    fecha: date | None


@dataclass(frozen=True)
class Excedente:
    """Lo estructural: qué queda de lo que entra cada mes (RF-23)."""
    ingreso: float
    gastos_fijos: float
    cuotas: float
    #: ingreso - gastos_fijos - cuotas. Puede ser negativo, y eso es un dato.
    excedente: float


@dataclass(frozen=True)
class Flujo:
    """Lo de caja: qué pasa de aquí al día de pago (RF-25)."""
    saldo: float
    proximo_pago: date
    dias: int
    #: Cargos conocidos que caen antes del próximo sueldo.
    comprometido: float
    #: saldo - comprometido. Lo que de verdad está libre hoy.
    holgura: float
    #: Estimación del gasto variable de los días que faltan.
    gasto_estimado: float
    #: Con qué saldo se llegaría al día de pago, si el gasto se porta igual.
    proyectado: float
    #: Qué tan firme es la estimación: meses de historial que la respaldan.
    meses_observados: int


def excedente_mensual(ingreso: float, gastos_fijos: float, cuotas: float) -> Excedente:
    """
    Lo que queda del sueldo después de lo que ya está comprometido.

    No descuenta el gasto variable: ese es justamente el que la persona decide,
    y mezclarlo haría que el excedente cambiara todos los días. Lo que este
    número dice es con cuánto se parte el mes.
    """
    return Excedente(
        ingreso=ingreso,
        gastos_fijos=gastos_fijos,
        cuotas=cuotas,
        excedente=ingreso - gastos_fijos - cuotas,
    )


def proximo_pago(dia_de_pago: int, hoy: date) -> date:
    """
    Cuándo llega el próximo sueldo, dado el día del mes en que suele llegar.

    Si el día ya pasó este mes, es el mes siguiente. Y si el mes de destino es
    más corto que el día pedido (un sueldo el 31 en un febrero), se corre al
    último día: es lo que hacen los bancos y lo que la persona ve en su cuenta.
    """
    def en(anio: int, mes: int) -> date:
        return date(anio, mes, min(dia_de_pago, calendar.monthrange(anio, mes)[1]))

    este_mes = en(hoy.year, hoy.month)
    if este_mes > hoy:
        return este_mes
    siguiente = hoy.replace(day=1) + timedelta(days=32)
    return en(siguiente.year, siguiente.month)


#: Días que se le asignan a un mes para repartir su gasto. Es el mismo valor
#: que usa la normalización de periodicidades de las suscripciones.
DIAS_DEL_MES = 30


def gasto_variable_diario(gasto_por_mes: list[float]) -> float:
    """
    Cuánto se gasta al día, descontando lo fijo.

    Recibe el gasto variable de meses COMPLETOS, no de días. Agregar por mes y
    no por día es lo que hace que la cifra signifique algo: casi nadie compra
    todos los días, así que la mediana del gasto diario daría cero y la
    proyección prometería que no se va a gastar nada. Es el mismo criterio con
    el que la proyección de metas trabaja sobre excedentes mensuales.

    Lo fijo no entra aquí: va por `compromisos`, con su fecha. Si viniera por
    los dos lados se contaría dos veces y la proyección saldría más negra de
    lo que es.

    Mediana y no promedio: un mes con un notebook no describe el mes normal.
    """
    if not gasto_por_mes:
        return 0.0
    return float(statistics.median(gasto_por_mes)) / DIAS_DEL_MES


def flujo_hasta_el_pago(saldo: float, dia_de_pago: int | None,
                        compromisos: list[Compromiso],
                        gasto_variable_por_mes: list[float],
                        hoy: date) -> Flujo | None:
    """
    Proyecta el saldo hasta el próximo sueldo, o None si no se sabe cuándo es.

    Devolver None es deliberado: sin fecha de pago no hay horizonte, y un
    horizonte inventado produce una respuesta que suena precisa y no lo es.
    """
    if dia_de_pago is None:
        return None

    pago = proximo_pago(dia_de_pago, hoy)
    dias = (pago - hoy).days

    # Solo lo que todavía no se cobró: lo que ya pasó está en el saldo.
    comprometido = sum(
        c.monto for c in compromisos
        if c.fecha is not None and hoy < c.fecha <= pago
    )

    # El gasto variable y los compromisos son los dos lados del gasto, así que
    # sumarlos no cuenta nada dos veces.
    gasto_estimado = gasto_variable_diario(gasto_variable_por_mes) * dias
    holgura = saldo - comprometido

    return Flujo(
        saldo=saldo,
        proximo_pago=pago,
        dias=dias,
        comprometido=comprometido,
        holgura=holgura,
        gasto_estimado=gasto_estimado,
        proyectado=holgura - gasto_estimado,
        meses_observados=len(gasto_variable_por_mes),
    )
