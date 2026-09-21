# -*- coding: utf-8 -*-
"""
Datos del banco simulado.

Las cuentas están escritas acá porque son pocas y no cambian. Los movimientos
se leen de datos_banco.json, que produce el generador:

    python -m app.generador
"""
import json
from datetime import datetime
from pathlib import Path

ARCHIVO = Path(__file__).parent / "datos_banco.json"


# ─────────────────────────── cuentas ───────────────────────────
CUENTAS = [
    {
        "accountId": "CTA-0001",
        "accountType": "Cuenta Corriente",
        "nickname": "Mi cuenta sueldo",
        "status": "Activa",
        "currency": "CLP",
        "openingDate": "2021-03-15",
        "ownerName": "JOSSUE PADRON",
        "branch": "Puerto Montt Centro",
        "productName": "Cuenta Corriente Persona",
    },
    {
        "accountId": "CTA-0002",
        "accountType": "Cuenta Vista",
        "nickname": "Ahorro",
        "status": "Activa",
        "currency": "CLP",
        "openingDate": "2023-08-01",
        "ownerName": "JOSSUE PADRON",
        "branch": "Puerto Montt Centro",
        "productName": "Cuenta Vista Digital",
    },
]


# ─────────────────────────── movimientos ───────────────────────────
def _cargar():
    """
    Lee los movimientos del archivo generado.

    Las fechas se guardaron como texto (JSON no tiene tipo fecha), así que hay
    que convertirlas de vuelta a datetime para poder filtrar y ordenar.
    """
    if not ARCHIVO.exists():
        raise FileNotFoundError(
            "Falta %s. Generalo con:  python -m app.generador" % ARCHIVO.name)

    movs = json.loads(ARCHIVO.read_text(encoding="utf-8"))
    for m in movs:
        m["bookingDateTime"] = datetime.fromisoformat(m["bookingDateTime"])
    return movs


# Todo el historial generado corresponde a la cuenta sueldo.
# La cuenta de ahorro tiene solo una transferencia, escrita a mano.
MOVIMIENTOS = {
    "CTA-0001": _cargar(),
    "CTA-0002": [
        {
            "transactionID": "TXN-AHO-0001",
            "bookingDateTime": datetime.fromisoformat("2026-08-30T15:00:00+00:00"),
            "transactionsType": "Abono",
            "amount": 120000.0,
            "currency": "CLP",
            "paymentPurposeCode": "Transferencia entre cuentas propias",
        }
    ],
}


# ─────────────────────────── saldos ───────────────────────────
def _saldo(cuenta_id):
    """
    Calcula el saldo sumando los abonos y restando los cargos.
    Así el saldo siempre cuadra con los movimientos.
    """
    total = 0.0
    for m in MOVIMIENTOS.get(cuenta_id, []):
        total += m["amount"] if m["transactionsType"] == "Abono" else -m["amount"]
    return round(total)


SALDOS = {
    c["accountId"]: {
        "amount": float(_saldo(c["accountId"])),
        "currency": "CLP",
        "type": "Disponible",
    }
    for c in CUENTAS
}
