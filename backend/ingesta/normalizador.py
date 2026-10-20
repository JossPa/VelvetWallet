# -*- coding: utf-8 -*-
"""
Normalización: del formato del banco al modelo canónico.

Esta capa NO sabe de dónde vienen los datos ni a qué base van. Solo traduce un
movimiento/cuenta tal como los define el estándar SFA a los campos de las tablas
de PostgreSQL. Es la "costura" entre las dos mitades del proyecto, y es
independiente del proveedor: sirve igual para el simulador o un banco real.
"""
from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from decimal import Decimal

from clasificador import clasificar

# accountType del banco → tipo canónico (CHECK de la tabla cuenta).
_TIPOS_CUENTA = {
    "cuenta corriente": "corriente",
    "cuenta vista": "vista",
    "cuenta de ahorro": "ahorro",
    "cuenta ahorro": "ahorro",
    "tarjeta de credito": "credito",
    "linea de credito": "credito",
}


def tipo_cuenta(account_type: str | None) -> str | None:
    if not account_type:
        return None
    return _TIPOS_CUENTA.get(account_type.strip().lower(), "otro")


def monto_con_signo(amount: float, tipo_movimiento: str) -> Decimal:
    """
    El banco manda el monto SIEMPRE positivo, más 'Cargo' o 'Abono'. El modelo
    canónico lo guarda con signo: negativo = cargo (gasto), positivo = abono
    (ingreso). Así el saldo es un simple SUM(monto) y los filtros salen naturales.

    Se convierte a Decimal, nunca float: el dinero no se guarda en coma flotante.
    """
    valor = Decimal(str(amount))
    return -valor if (tipo_movimiento or "").lower() == "cargo" else valor


def _glosa(mov: dict) -> str | None:
    """Descripción cruda: nombre del comercio, o el motivo si es transferencia."""
    comercio = (mov.get("merchantDetails") or {}).get("name")
    return comercio or mov.get("paymentPurposeCode")


def _fecha_hora(mov: dict) -> str:
    """bookingDateTime normalizado a UTC (ISO), para la huella."""
    valor = mov["bookingDateTime"]
    if not isinstance(valor, datetime):
        valor = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    if valor.tzinfo is not None:
        valor = valor.astimezone(timezone.utc)
    return valor.isoformat()


def _fecha(mov: dict) -> date:
    valor = mov["bookingDateTime"]
    if isinstance(valor, datetime):
        return valor.date()
    return datetime.fromisoformat(str(valor)).date()


def _categoria_origen(mov: dict) -> str | None:
    """
    Categoría tal como la manda la institución.

    Es OPCIONAL en el estándar y cada proveedor usa su propia taxonomía, sin
    equivalencia común entre instituciones. Por eso se guarda tal cual, en una
    columna aparte de categoria_id: es una **señal de entrada** del clasificador,
    no una categoría del sistema. El clasificador, además de clasificar desde
    cero lo que llega sin categoría, tiene que normalizar estas taxonomías
    distintas entre proveedores.
    """
    return (mov.get("merchantDetails") or {}).get("category")


def hash_dedup(usuario_id: str, account_id: str, mov: dict) -> str:
    """
    Huella del movimiento para deduplicar la MISMA compra de UN usuario llegada
    por dos fuentes distintas (API y cartola CSV). Se calcula sobre campos
    intrínsecos, no sobre el transactionID (que es propio de cada fuente).
    SHA-256 hex.

    Incluye el usuario_id a propósito: así dos usuarios distintos que conectan el
    mismo banco (mismos datos) NO chocan en la clave única `hash_dedup`, pero la
    deduplicación entre fuentes de un mismo usuario se mantiene.

    Nota: la actualización pendiente→confirmada NO se resuelve con este hash,
    sino con id_externo (transactionID). Ver repositorio.upsert_transacciones_bulk.
    """
    partes = [
        str(usuario_id),
        account_id,
        # Fecha CON hora: dos compras iguales el mismo día (dos cafés de $3.500)
        # son dos movimientos distintos. Con solo la fecha chocaban en la clave
        # única y la sincronización completa fallaba.
        _fecha_hora(mov),
        str(mov.get("amount")),
        (mov.get("transactionsType") or ""),
        (_glosa(mov) or ""),
    ]
    crudo = "|".join(partes)
    return hashlib.sha256(crudo.encode("utf-8")).hexdigest()


def cuenta_canonica(cuenta: dict, saldo: dict | None) -> dict:
    """Cuenta del banco → columnas de la tabla `cuenta`."""
    return {
        "id_externo": cuenta["accountId"],
        "tipo": tipo_cuenta(cuenta.get("accountType")),
        "moneda": cuenta.get("currency", "CLP"),
        "saldo": Decimal(str(saldo["amount"])) if saldo else None,
    }


def categoria_propuesta(glosa: str | None, monto) -> tuple[str | None, float | None]:
    """
    Lo que propone el clasificador (bloque E) para un movimiento: (categoría,
    confianza). Solo para gastos: los abonos no se categorizan. Si se abstiene,
    (None, None) y el movimiento cae en "Por revisar" (RF-17 / RNF-33).
    La confianza es None cuando decidió una regla (no es parcial).
    """
    if monto >= 0 or not glosa:
        return None, None
    r = clasificar(glosa)
    if r.categoria is None:
        return None, None
    return r.categoria, (round(r.confianza, 4) if r.confianza is not None else None)


def transaccion_canonica(usuario_id: str, account_id: str, mov: dict) -> dict:
    """Movimiento del banco → columnas de la tabla `transaccion`."""
    monto = monto_con_signo(mov["amount"], mov.get("transactionsType"))
    glosa = _glosa(mov)
    categoria, confianza = categoria_propuesta(glosa, monto)
    return {
        "id_externo": mov["transactionID"],
        "monto": monto,
        "moneda": mov.get("currency", "CLP"),
        "fecha": _fecha(mov),
        "glosa_original": glosa,
        "categoria_origen": _categoria_origen(mov),
        "hash_dedup": hash_dedup(usuario_id, account_id, mov),
        # Categoría de Velvet que propone el clasificador (nombre; el
        # repositorio la traduce a categoria_id). None = se abstuvo.
        "categoria_nombre": categoria,
        "confianza_clasificacion": confianza,
        # El estado es 'confirmado' porque el estándar no expone "pendiente":
        # eso se detecta al re-sincronizar.
        "estado": "confirmado",
    }
