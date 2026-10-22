# -*- coding: utf-8 -*-
"""
Plazo de notificación de brechas de datos personales (Ley 21.719, RF-29).

Cuando ocurre una vulneración de seguridad que afecta datos personales, la ley
obliga a notificarla. Lo que este módulo calcula es **el reloj**: desde cuándo
corre, cuánto queda y cuándo se venció.

Dos detalles que parecen menores y no lo son:

**El plazo corre desde que se toma conocimiento, no desde que ocurre el
hecho.** Una brecha puede haber pasado hace semanas y descubrirse hoy; las 72
horas empiezan hoy. Por eso el incidente guarda las dos fechas por separado y
este cálculo usa solo la de detección.

**El plazo no se detiene al vencer.** Pasadas las 72 horas sigue habiendo
obligación de notificar: lo que cambia es que ya se incumplió. Mostrar
"vencido hace 2 días" en vez de dejar el contador en cero es la diferencia
entre un sistema que acompaña el cumplimiento y uno que lo disimula.

Es lógica pura: no sabe de base de datos ni de HTTP, y por eso se puede probar.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

# Lo que da la ley para notificar, contado desde la detección.
HORAS_DE_PLAZO = 72

# Bajo esto el plazo se considera urgente: queda menos de un día hábil para
# reunir la información, decidir y avisar.
HORAS_URGENTE = 24


@dataclass(frozen=True)
class Plazo:
    """
    Estado del reloj de notificación.

    `urgencia` es lo que la interfaz necesita para decidir cuánto gritar:
      holgado  → queda más de un día
      urgente  → queda menos de 24 horas
      vencido  → se pasó el plazo
      cumplido → ya se notificó dentro de plazo
      tardio   → ya se notificó, pero después del plazo
    """
    vence_at: datetime
    horas_restantes: float
    vencido: bool
    urgencia: str
    notificado: bool


def plazo_de(detectado_at: datetime, notificado_at: datetime | None = None,
             ahora: datetime | None = None) -> Plazo:
    """Calcula el estado del plazo de un incidente."""
    ahora = ahora or datetime.now(detectado_at.tzinfo)
    vence = detectado_at + timedelta(hours=HORAS_DE_PLAZO)

    if notificado_at is not None:
        a_tiempo = notificado_at <= vence
        return Plazo(
            vence_at=vence,
            # Ya notificado: lo que importa es si se llegó, no cuánto falta.
            horas_restantes=round((vence - notificado_at).total_seconds() / 3600, 1),
            vencido=not a_tiempo,
            urgencia="cumplido" if a_tiempo else "tardio",
            notificado=True,
        )

    restantes = (vence - ahora).total_seconds() / 3600
    if restantes <= 0:
        urgencia = "vencido"
    elif restantes <= HORAS_URGENTE:
        urgencia = "urgente"
    else:
        urgencia = "holgado"

    return Plazo(
        vence_at=vence,
        horas_restantes=round(restantes, 1),
        vencido=restantes <= 0,
        urgencia=urgencia,
        notificado=False,
    )


def describir(plazo: Plazo) -> str:
    """El plazo dicho como se lo cuentas a una persona, no en horas decimales."""
    horas = abs(plazo.horas_restantes)
    if plazo.notificado:
        return "Notificado dentro del plazo" if not plazo.vencido else "Notificado fuera de plazo"
    if plazo.vencido:
        return f"Plazo vencido hace {_duracion(horas)}"
    return f"Quedan {_duracion(horas)} para notificar"


def _duracion(horas: float) -> str:
    if horas < 1:
        minutos = max(1, int(horas * 60))
        return f"{minutos} minuto{'s' if minutos != 1 else ''}"
    if horas < 24:
        h = int(horas)
        return f"{h} hora{'s' if h != 1 else ''}"
    dias = int(horas // 24)
    return f"{dias} día{'s' if dias != 1 else ''}"
