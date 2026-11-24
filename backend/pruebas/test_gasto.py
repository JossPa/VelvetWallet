# -*- coding: utf-8 -*-
"""
Pruebas del gasto por categoría (motor/gasto.py).

La prueba que más importa es la primera: el backend tiene que dar exactamente
las mismas cifras que la app sobre el mismo caso. El caso vive del lado de la
app (`movil/src/utils/__tests__/datos/gasto-compartido.json`) y la app lo
prueba con sus propias funciones; si alguna de las dos implementaciones cambia
de regla, falla su prueba y el chat no puede quedar diciendo otra cosa que el
dashboard.
"""
import json
from pathlib import Path

import pytest

from motor import gasto

CASO = (Path(__file__).resolve().parents[2] / "movil" / "src" / "utils" / "__tests__"
        / "datos" / "gasto-compartido.json")


@pytest.fixture(scope="module")
def caso():
    return json.loads(CASO.read_text(encoding="utf-8"))


def mov(fecha, monto, categoria="Supermercado", comercio="Lider", excluido=False):
    return {"fecha": f"{fecha}T12:00:00-03:00", "monto": monto, "categoria": categoria,
            "comercio": comercio, "excluido": excluido}


# ── el mismo resultado que la app ───────────────────────────────────────────

def test_mismas_cifras_que_la_app(caso):
    esperado = caso["esperado"]
    r = gasto.gasto_por_categoria(caso["movimientos"], esperado["mes"])

    assert r["gasto_total"] == esperado["gasto_total"]
    assert {f["categoria"]: {"monto": f["monto"], "porcentaje": f["porcentaje"]}
            for f in r["por_categoria"]} == esperado["por_categoria"]
    assert r["por_categoria"][0]["categoria"] == esperado["categoria_mas_grande"]


def test_misma_comparacion_que_la_app(caso):
    esperado = caso["esperado"]["comparacion"]
    r = gasto.comparar_meses(caso["movimientos"], caso["esperado"]["mes"], cuantas=99)

    assert r["total"]["cambio_pct"] == esperado["total_cambio_pct"]
    assert {v["categoria"]: v["cambio_pct"] for v in r["por_categoria"]} == esperado["por_categoria"]


# ── las reglas, una por una ─────────────────────────────────────────────────

def test_no_cuenta_abonos_ni_excluidos():
    movs = [mov("2026-10-02", -10_000), mov("2026-10-03", 850_000, "Sueldo"),
            mov("2026-10-04", -5_000, excluido=True)]
    assert gasto.gasto_por_categoria(movs, "2026-10")["gasto_total"] == 10_000


def test_sin_categoria_se_cuenta_aparte():
    movs = [mov("2026-10-02", -10_000), mov("2026-10-03", -4_000, None, None)]
    filas = {f["categoria"]: f["monto"] for f in gasto.gasto_por_categoria(movs, "2026-10")["por_categoria"]}
    assert filas == {"Supermercado": 10_000, "Sin categorizar": 4_000}


def test_respeta_el_borde_del_mes():
    movs = [mov("2026-09-30", -1_000), mov("2026-10-01", -2_000), mov("2026-10-31", -3_000),
            mov("2026-11-01", -4_000)]
    assert gasto.gasto_por_categoria(movs, "2026-10")["gasto_total"] == 5_000


def test_subtotal_de_varias_categorias_lo_suma_el_codigo():
    movs = [mov("2026-10-02", -10_000, "Supermercado"), mov("2026-10-03", -3_000, "Delivery"),
            mov("2026-10-04", -50_000, "Vivienda")]
    pedidas = gasto.gasto_por_categoria(movs, "2026-10", ["supermercado", "Delivery", "Mascotas"])
    assert pedidas["categorias_pedidas"]["subtotal"] == 13_000
    assert pedidas["categorias_pedidas"]["no_encontradas"] == ["mascotas"]


def test_detalle_agrupa_por_comercio_de_mayor_a_menor():
    movs = [mov("2026-10-02", -10_000, comercio="Lider"), mov("2026-10-03", -30_000, comercio="Jumbo"),
            mov("2026-10-09", -5_000, comercio="Lider"), mov("2026-10-04", -9_000, "Delivery", "Rappi")]
    d = gasto.detalle_categoria(movs, "2026-10", "supermercado")
    assert d["total"] == 45_000
    assert d["por_comercio"] == [{"comercio": "Jumbo", "monto": 30_000, "compras": 1},
                                 {"comercio": "Lider", "monto": 15_000, "compras": 2}]


def test_sin_gasto_en_el_mes_de_referencia_no_hay_comparacion():
    assert gasto.comparar_meses([mov("2026-10-02", -10_000)], "2026-10") is None


@pytest.mark.parametrize("mes, anterior", [("2026-10", "2026-09"), ("2026-01", "2025-12")])
def test_mes_anterior(mes, anterior):
    assert gasto.mes_anterior(mes) == anterior


@pytest.mark.parametrize("valor, esperado", [(12.5, 13), (0.5, 1), (-0.5, 0), (2.4, 2), (-12.5, -12)])
def test_redondea_como_javascript(valor, esperado):
    # Math.round(-12.5) === -12 en JavaScript; round(-12.5) == -12 en Python
    # por casualidad, pero round(12.5) == 12. Se fija la regla de la app.
    assert gasto.redondear(valor) == esperado


# ── gasto en un comercio ────────────────────────────────────────────────────

from datetime import date  # noqa: E402


@pytest.mark.parametrize("hoy, cuantos, actual, esperado", [
    (date(2026, 11, 17), 3, False, ["2026-08", "2026-09", "2026-10"]),
    (date(2026, 11, 17), 3, True, ["2026-08", "2026-09", "2026-10", "2026-11"]),
    (date(2026, 2, 3), 3, False, ["2025-11", "2025-12", "2026-01"]),
    (date(2026, 11, 17), 0, False, ["2026-10"]),
    (date(2026, 11, 17), 0, True, ["2026-11"]),
])
def test_ultimos_meses_los_calcula_el_codigo(hoy, cuantos, actual, esperado):
    assert gasto.ultimos_meses(hoy, cuantos, actual) == esperado


def test_gasto_en_comercio_suma_por_mes_sin_importar_mayusculas_ni_tildes():
    movs = [
        mov("2026-08-10", -20_000, "Vestuario", "Falabella"),
        mov("2026-10-25", -30_000, "Vestuario", "Falabella.com"),
        mov("2026-10-26", -5_000, "Vestuario", "FALABELLA"),
        mov("2026-10-27", -9_000, "Vestuario", "Falabella", excluido=True),
        mov("2026-10-28", 15_000, "Vestuario", "Falabella"),          # devolución: abono
        mov("2026-10-29", -7_000, "Vestuario", "Paris"),
        mov("2026-11-02", -40_000, "Vestuario", "Falabella"),         # fuera del período
        mov("2026-09-12", -3_000, "Salud", "Farmacias Ahumada"),
    ]
    r = gasto.gasto_en_comercio(movs, "falabella", ["2026-08", "2026-09", "2026-10"])

    assert r["total"] == 55_000 and r["compras"] == 3
    assert r["por_mes"] == [{"mes": "2026-08", "monto": 20_000, "compras": 1},
                            {"mes": "2026-09", "monto": 0, "compras": 0},
                            {"mes": "2026-10", "monto": 35_000, "compras": 2}]
    assert r["comercios_que_calzaron"] == ["FALABELLA", "Falabella", "Falabella.com"]
    assert gasto.gasto_en_comercio(movs, "farmacias ahumáda", ["2026-09"])["total"] == 3_000


def test_comercio_que_no_existe_devuelve_cero_y_lo_dice():
    r = gasto.gasto_en_comercio([mov("2026-10-02", -10_000)], "Ripley", ["2026-10"])
    assert r["total"] == 0 and r["comercios_que_calzaron"] == []


def test_mismo_promedio_mensual_que_la_app(caso):
    hoy = date.fromisoformat(caso["hoy"])
    r = gasto.promedio_mensual(caso["movimientos"], hoy)
    assert r["promedio_mensual"] == caso["esperado"]["promedio_mensual_6_meses"]


# ── promedio mensual ────────────────────────────────────────────────────────

def test_promedio_deja_fuera_el_mes_en_curso_y_los_meses_sin_historial():
    movs = [mov("2026-09-10", -100_000), mov("2026-10-10", -300_000), mov("2026-11-03", -5_000)]
    r = gasto.promedio_mensual(movs, date(2026, 11, 17))
    assert r["meses_considerados"] == ["2026-09", "2026-10"]
    assert r["promedio_mensual"] == 200_000


def test_promedio_de_categoria_cuenta_como_cero_el_mes_sin_esa_categoria():
    movs = [mov("2026-09-10", -100_000, "Supermercado"), mov("2026-09-11", -20_000, "Delivery"),
            mov("2026-10-10", -90_000, "Supermercado")]
    r = gasto.promedio_mensual(movs, date(2026, 11, 17), "delivery")
    assert r["promedio_mensual"] == 10_000          # (20.000 + 0) / 2


# ── gastos hormiga ──────────────────────────────────────────────────────────

def test_gastos_hormiga_chicos_repetidos_y_no_recurrentes():
    movs = [mov("2026-09-02", -2_500, "Delivery", "Starbucks"),
            mov("2026-09-15", -2_500, "Delivery", "Starbucks"),
            mov("2026-10-03", -3_000, "Delivery", "Starbucks"),
            mov("2026-10-04", -1_200, "Transporte", "Metro"),           # solo 2 veces: no es hábito
            mov("2026-10-05", -1_200, "Transporte", "Metro"),
            mov("2026-10-06", -45_000, "Vestuario", "Starbucks"),     # sobre el umbral
            {**mov("2026-09-20", -5_990, "Suscripciones", "Spotify"), "esRecurrente": True},
            {**mov("2026-10-20", -5_990, "Suscripciones", "Spotify"), "esRecurrente": True},
            {**mov("2026-08-20", -5_990, "Suscripciones", "Spotify"), "esRecurrente": True}]
    r = gasto.gastos_hormiga(movs, ["2026-08", "2026-09", "2026-10"])
    assert r["por_comercio"] == [{"comercio": "Starbucks", "monto": 8_000, "compras": 3}]
    assert r["total_del_periodo"] == 8_000 and r["promedio_por_mes"] == 2_667
    assert "$10.000" in r["criterio"]
