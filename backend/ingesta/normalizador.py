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
from datetime import date, datetime
from decimal import Decimal

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


def _fecha(mov: dict) -> date:
    valor = mov["bookingDateTime"]
    if isinstance(valor, datetime):
        return valor.date()
    return datetime.fromisoformat(str(valor)).date()


def hash_dedup(account_id: str, mov: dict) -> str:
    """
    Huella del movimiento para deduplicar la MISMA compra llegada por dos
    fuentes distintas (API y cartola CSV). Se calcula sobre campos intrínsecos,
    no sobre el transactionID (que es propio de cada fuente). SHA-256 hex.

    Nota: la actualización pendiente→confirmada NO se resuelve con este hash,
    sino con id_externo (transactionID). Ver repositorio.upsert_transaccion.
    """
    partes = [
        account_id,
        _fecha(mov).isoformat(),
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


def transaccion_canonica(account_id: str, mov: dict) -> dict:
    """Movimiento del banco → columnas de la tabla `transaccion`."""
    return {
        "id_externo": mov["transactionID"],
        "monto": monto_con_signo(mov["amount"], mov.get("transactionsType")),
        "moneda": mov.get("currency", "CLP"),
        "fecha": _fecha(mov),
        "glosa_original": _glosa(mov),
        "categoria_origen": _categoria_origen(mov),
        "hash_dedup": hash_dedup(account_id, mov),
        # categoria_id se deja en NULL: clasificar es otra etapa (RF-17,
        # el clasificador se abstiene). El estado es 'confirmado' porque el
        # estándar no expone "pendiente": eso se detecta al re-sincronizar.
        "estado": "confirmado",
    }
