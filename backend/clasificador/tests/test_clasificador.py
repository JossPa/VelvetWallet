# -*- coding: utf-8 -*-
"""
Pruebas del clasificador. Correr con:  python -m pytest clasificador/tests -q
(o, sin pytest:  python -m clasificador.tests.test_clasificador)
"""
from __future__ import annotations

from pathlib import Path

from clasificador.reglas import clasificar_por_reglas
from clasificador.modelo import ClasificadorGastos
from clasificador.dataset import generar_dataset
from clasificador import clasificar
from clasificador.taxonomia import CATEGORIAS, GOLD_COMERCIO
from clasificador.dataset import GLOSAS_SIN_COMERCIO, _VARIANTES


def test_reglas_reconocen_comercios_conocidos():
    assert clasificar_por_reglas("NETFLIX.COM 123") == "Entretención"
    assert clasificar_por_reglas("COMPRA LIDER LAS CONDES") == "Supermercado"
    assert clasificar_por_reglas("PAGO CGE") == "Servicios"


def test_reglas_se_abstienen_si_no_conocen():
    assert clasificar_por_reglas("COMERCIO XYZ QUE NADIE CONOCE") is None


def test_modelo_entrena_y_predice():
    datos = generar_dataset("train", por_comercio=60)
    m = ClasificadorGastos(umbral=0.5).entrenar(
        [g for g, _ in datos], [c for _, c in datos]
    )
    cat, conf = m.predecir("COMPRA WEB LIDER.CL 4821")
    assert cat == "Supermercado"
    assert 0.0 <= conf <= 1.0


def test_modelo_se_abstiene_con_basura():
    datos = generar_dataset("train", por_comercio=60)
    m = ClasificadorGastos(umbral=0.99).entrenar(
        [g for g, _ in datos], [c for _, c in datos]
    )
    cat, _ = m.predecir("zzzz qwerty 9999")
    assert cat is None  # umbral altísimo: se abstiene


def test_categorias_validas():
    datos = generar_dataset("train", por_comercio=40)
    for _, c in datos:
        assert c in CATEGORIAS


def test_cascada_devuelve_resultado():
    r = clasificar("NETFLIX 123")
    assert r.categoria == "Entretención"
    assert r.origen == "regla" and r.confianza is None   # una regla no es parcial


def test_cascada_usa_el_modelo_cuando_la_regla_no_reconoce():
    r = clasificar("COMPRA WEB FALABELA 4821")     # errata: ninguna regla calza
    assert r.categoria == "Vestuario"
    assert r.origen == "modelo" and 0.55 <= r.confianza <= 1.0


def test_trampas_conocidas():
    # Uber (viaje) no es Uber Eats (comida); Metrogas no es el Metro.
    assert clasificar("UBER* EATS 7741 STGO").categoria == "Delivery"
    assert clasificar("UBER TRIP 2231").categoria == "Transporte"
    assert clasificar("PAGO METRO GAS 5114").categoria == "Servicios"
    assert clasificar("CARGA BIP METRO 991").categoria == "Transporte"


def test_se_abstiene_sin_comercio():
    for glosa in GLOSAS_SIN_COMERCIO:
        r = clasificar(glosa)
        assert r.categoria is None, glosa


def test_cada_comercio_tiene_variantes_y_categoria_valida():
    assert set(_VARIANTES) == set(GOLD_COMERCIO)
    for comercio, categoria in GOLD_COMERCIO.items():
        assert categoria in CATEGORIAS, comercio


def test_todos_los_comercios_del_simulador_se_clasifican_bien():
    for comercio, categoria in GOLD_COMERCIO.items():
        assert clasificar(comercio).categoria == categoria, comercio


if __name__ == "__main__":
    # Corre las pruebas sin pytest.
    import sys
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    fallas = 0
    for fn in fns:
        try:
            fn()
            print(f"OK   {fn.__name__}")
        except AssertionError as e:
            fallas += 1
            print(f"FALLA {fn.__name__}: {e}")
    sys.exit(1 if fallas else 0)
