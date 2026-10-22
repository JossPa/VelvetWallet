# -*- coding: utf-8 -*-
"""
Pruebas del detector de gastos recurrentes.

El objetivo específico 4 compromete tres tolerancias —monto, fecha y glosa— así
que hay una prueba por cada una, y su espejo: que la tolerancia no sea tan laxa
como para marcar como suscripción un gasto que no lo es. Un detector que
encuentra recurrencias en todas partes es tan inútil como uno que no encuentra
ninguna.
"""
from datetime import date, timedelta

from motor.recurrencias import (
    MINIMO_COBROS,
    Cobro,
    clave_comercio,
    detectar,
    gasto_fijo_mensual,
)

HOY = date(2026, 10, 22)


def serie(glosa, inicio, dias, veces, monto, variacion=0):
    """Serie regular de cobros, con una variación opcional de monto por cobro."""
    return [
        Cobro(
            id=f"{glosa}-{i}",
            fecha=inicio + timedelta(days=dias * i),
            monto=monto + variacion * i,
            glosa=glosa,
        )
        for i in range(veces)
    ]


class TestClaveComercio:
    def test_ignora_numero_de_local_y_ciudad(self):
        assert clave_comercio("UBER *EATS 8829 SANTIAGO") == clave_comercio(
            "uber *eats 1142 Providencia"
        )

    def test_ignora_tildes_y_signos(self):
        assert clave_comercio("Farmacia Ahumada") == clave_comercio("FARMACIA AHUMADÁ")

    def test_no_agrupa_comercios_distintos(self):
        assert clave_comercio("Netflix") != clave_comercio("Spotify")

    def test_una_glosa_de_puros_numeros_se_conserva(self):
        # Si al limpiar no queda nada, agrupar seria peor que no agrupar.
        assert clave_comercio("4471 8829") == "4471 8829"


class TestAbstencion:
    def test_con_menos_del_minimo_de_cobros_no_reporta_nada(self):
        for veces in range(MINIMO_COBROS):
            cobros = serie("Netflix", date(2026, 7, 5), 30, veces, 5990)
            assert detectar(cobros, HOY) == []

    def test_con_el_minimo_ya_la_detecta(self):
        cobros = serie("Netflix", date(2026, 8, 5), 30, MINIMO_COBROS, 5990)
        assert len(detectar(cobros, HOY)) == 1

    def test_un_solo_cobro_grande_no_es_suscripcion(self):
        cobros = [Cobro("x", date(2026, 9, 1), 450_000, "Notebook")]
        assert detectar(cobros, HOY) == []

    def test_los_abonos_se_ignoran(self):
        # El sueldo llega todos los meses y es regularisimo, pero no es un gasto.
        cobros = [
            Cobro(f"s{i}", date(2026, 5, 30) + timedelta(days=30 * i), -850_000, "Sueldo")
            for i in range(6)
        ]
        assert detectar(cobros, HOY) == []


class TestToleranciaDeFecha:
    def test_un_cobro_mensual_no_cae_el_mismo_dia(self):
        # Fin de mes real: 31 de enero, 28 de febrero, 31 de marzo…
        fechas = [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31),
                  date(2026, 4, 30), date(2026, 5, 31)]
        cobros = [Cobro(f"a{i}", f, 12_000, "Gimnasio") for i, f in enumerate(fechas)]
        r = detectar(cobros, date(2026, 6, 15))
        assert len(r) == 1
        assert r[0].periodicidad == "mensual"

    def test_tolera_que_un_cobro_se_corra_al_dia_habil(self):
        fechas = [date(2026, 6, 5), date(2026, 7, 6), date(2026, 8, 5),
                  date(2026, 9, 7), date(2026, 10, 5)]
        cobros = [Cobro(f"b{i}", f, 5990, "Spotify") for i, f in enumerate(fechas)]
        assert detectar(cobros, HOY)[0].periodicidad == "mensual"

    def test_reconoce_otras_periodicidades(self):
        assert detectar(serie("Diario", date(2026, 9, 1), 7, 6, 3000), HOY)[0].periodicidad == "semanal"
        assert detectar(serie("Seguro", date(2026, 1, 10), 91, 4, 40_000), HOY)[0].periodicidad == "trimestral"

    def test_fechas_sin_periodicidad_no_son_recurrencia(self):
        # Un supermercado: varias compras en un mes, ninguna en otro.
        fechas = [date(2026, 9, 1), date(2026, 9, 3), date(2026, 9, 17),
                  date(2026, 10, 2), date(2026, 10, 3)]
        cobros = [Cobro(f"c{i}", f, 30_000, "Lider") for i, f in enumerate(fechas)]
        assert detectar(cobros, HOY) == []


class TestToleranciaDeMonto:
    def test_una_cuenta_de_servicios_varia_y_sigue_siendo_recurrente(self):
        montos = [18_400, 21_900, 17_200, 20_100, 19_050]
        cobros = [
            Cobro(f"d{i}", date(2026, 6, 10) + timedelta(days=30 * i), m, "Essal")
            for i, m in enumerate(montos)
        ]
        r = detectar(cobros, HOY)
        assert len(r) == 1
        assert 17_000 <= r[0].monto_esperado <= 21_000

    def test_montos_disparatados_no_son_el_mismo_cobro(self):
        montos = [5_000, 90_000, 12_000, 150_000, 8_000]
        cobros = [
            Cobro(f"e{i}", date(2026, 6, 10) + timedelta(days=30 * i), m, "Retail")
            for i, m in enumerate(montos)
        ]
        assert detectar(cobros, HOY) == []

    def test_detecta_que_subio_de_precio(self):
        montos = [5_990, 5_990, 5_990, 5_990, 9_990]
        cobros = [
            Cobro(f"f{i}", date(2026, 6, 5) + timedelta(days=30 * i), m, "Netflix")
            for i, m in enumerate(montos)
        ]
        r = detectar(cobros, HOY)[0]
        assert r.subio_de_precio is True
        assert r.monto_ultimo == 9_990

    def test_un_precio_estable_no_se_marca_como_alza(self):
        r = detectar(serie("Spotify", date(2026, 5, 5), 30, 6, 5990), HOY)[0]
        assert r.subio_de_precio is False


class TestToleranciaDeGlosa:
    def test_la_misma_suscripcion_escrita_distinta_se_agrupa(self):
        fechas = [date(2026, 6, 12), date(2026, 7, 12), date(2026, 8, 13), date(2026, 9, 12)]
        glosas = [
            "SMARTFIT 221 SANTIAGO",
            "smartfit 904 providencia",
            "SMART FIT",
            "SmartFit 112 Las Condes",
        ]
        cobros = [Cobro(f"g{i}", f, 19_990, g) for i, (f, g) in enumerate(zip(fechas, glosas))]
        r = detectar(cobros, HOY)
        assert len(r) == 1
        assert r[0].cobros == 4

    def test_muestra_la_glosa_mas_reciente_y_no_la_clave(self):
        # La persona reconoce el nombre que vio la ultima vez.
        r = detectar(
            [
                Cobro("h0", date(2026, 7, 2), 9990, "NETFLIX.COM 001"),
                Cobro("h1", date(2026, 8, 2), 9990, "NETFLIX.COM 002"),
                Cobro("h2", date(2026, 9, 2), 9990, "Netflix"),
            ],
            HOY,
        )[0]
        assert r.nombre == "Netflix"


class TestEstadoYProyeccion:
    def test_estima_el_proximo_cobro(self):
        r = detectar(serie("Spotify", date(2026, 7, 5), 30, 4, 5990), HOY)[0]
        assert r.proxima_fecha_estimada == r.ultima_fecha + timedelta(days=30)

    def test_una_suscripcion_vieja_se_da_de_baja(self):
        # Se dejo de cobrar en marzo; en octubre ya no esta activa.
        cobros = serie("Revista", date(2025, 12, 1), 30, 4, 4000)
        assert detectar(cobros, HOY)[0].activa is False

    def test_una_suscripcion_al_dia_sigue_activa(self):
        cobros = serie("Gimnasio", date(2026, 7, 20), 30, 4, 19_990)
        assert detectar(cobros, HOY)[0].activa is True

    def test_se_ordenan_de_mayor_a_menor_monto(self):
        cobros = (
            serie("Spotify", date(2026, 6, 5), 30, 5, 5_990)
            + serie("Arriendo", date(2026, 6, 1), 30, 5, 420_000)
            + serie("Gimnasio", date(2026, 6, 10), 30, 5, 19_990)
        )
        assert [r.nombre for r in detectar(cobros, HOY)] == ["Arriendo", "Gimnasio", "Spotify"]


class TestGastoFijo:
    def test_suma_el_compromiso_mensual(self):
        cobros = (
            serie("Arriendo", date(2026, 7, 1), 30, 4, 400_000)
            + serie("Spotify", date(2026, 7, 5), 30, 4, 6_000)
        )
        assert gasto_fijo_mensual(detectar(cobros, HOY)) == 406_000

    def test_lleva_lo_semanal_a_base_mensual(self):
        cobros = serie("Feria", date(2026, 9, 1), 7, 7, 10_000)
        # Siete días: cerca de 4,3 cobros al mes.
        assert gasto_fijo_mensual(detectar(cobros, HOY)) == 42_857

    def test_lo_que_ya_no_se_cobra_no_suma(self):
        cobros = serie("Revista", date(2025, 12, 1), 30, 4, 4_000)
        assert gasto_fijo_mensual(detectar(cobros, HOY)) == 0
