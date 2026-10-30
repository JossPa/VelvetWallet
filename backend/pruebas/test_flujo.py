# -*- coding: utf-8 -*-
"""
Pruebas del excedente mensual y del flujo de caja (RF-23, RF-25).

Lo que más se verifica aquí es que no se cuente dos veces y que no se invente
nada. Las dos cosas producen el mismo daño: un "te alcanza" o un "no te
alcanza" que la persona no puede contrastar con su cuenta, y que si se equivoca
durante la demostración deja en duda todo lo demás.
"""
from datetime import date

from motor.flujo import (
    DIAS_DEL_MES,
    Compromiso,
    excedente_mensual,
    flujo_hasta_el_pago,
    gasto_variable_diario,
    proximo_pago,
)

HOY = date(2026, 10, 12)

#: Un historial que da exactamente 10.000 al día, para que las cuentas de las
#: pruebas se puedan seguir de cabeza.
DIEZ_MIL_AL_DIA = [10_000 * DIAS_DEL_MES] * 6


class TestExcedente:
    def test_descuenta_fijos_y_cuotas(self):
        e = excedente_mensual(ingreso=850_000, gastos_fijos=386_053, cuotas=148_900)
        assert e.excedente == 850_000 - 386_053 - 148_900

    def test_conserva_las_partes_para_poder_explicarlo(self):
        # La cifra sola no sirve: la pantalla tiene que poder desglosarla.
        e = excedente_mensual(900_000, 200_000, 100_000)
        assert (e.ingreso, e.gastos_fijos, e.cuotas) == (900_000, 200_000, 100_000)

    def test_puede_ser_negativo(self):
        # Comprometer más de lo que entra es un dato, no un error que ocultar.
        assert excedente_mensual(500_000, 400_000, 200_000).excedente == -100_000

    def test_sin_ingreso_conocido_queda_en_negativo_de_lo_comprometido(self):
        assert excedente_mensual(0, 120_000, 0).excedente == -120_000


class TestProximoPago:
    def test_si_el_dia_no_ha_llegado_es_este_mes(self):
        assert proximo_pago(30, date(2026, 10, 12)) == date(2026, 10, 30)

    def test_si_ya_paso_es_el_mes_siguiente(self):
        assert proximo_pago(5, date(2026, 10, 12)) == date(2026, 11, 5)

    def test_el_mismo_dia_de_pago_apunta_al_siguiente(self):
        # Si hoy es día de pago, el sueldo ya llegó: el horizonte es el próximo.
        assert proximo_pago(12, date(2026, 10, 12)) == date(2026, 11, 12)

    def test_se_corre_al_ultimo_dia_si_el_mes_es_corto(self):
        assert proximo_pago(31, date(2026, 1, 31)) == date(2026, 2, 28)

    def test_cruza_el_fin_de_anio(self):
        assert proximo_pago(5, date(2026, 12, 20)) == date(2027, 1, 5)


class TestGastoVariable:
    def test_usa_la_mediana_y_no_el_promedio(self):
        # Un mes con una compra grande no define el mes normal.
        meses = [300_000, 360_000, 330_000, 270_000, 2_400_000]
        assert gasto_variable_diario(meses) == 330_000 / DIAS_DEL_MES

    def test_reparte_el_mes_en_dias(self):
        assert gasto_variable_diario([300_000]) == 10_000

    def test_sin_historial_es_cero(self):
        assert gasto_variable_diario([]) == 0.0


class TestFlujo:
    def test_descuenta_solo_lo_que_todavia_no_se_cobra(self):
        # La cuota del 5 ya se pagó (hoy es 12) y está en el saldo: contarla de
        # nuevo seria descontarla dos veces.
        compromisos = [
            Compromiso("Cuota crédito", 148_900, date(2026, 10, 5)),
            Compromiso("Netflix", 9_900, date(2026, 10, 20)),
        ]
        f = flujo_hasta_el_pago(500_000, 30, compromisos, [], HOY)
        assert f.comprometido == 9_900

    def test_lo_que_cae_despues_del_pago_no_entra(self):
        # El horizonte termina el día de pago; lo de noviembre es otro ciclo.
        compromisos = [Compromiso("Gimnasio", 30_000, date(2026, 11, 3))]
        f = flujo_hasta_el_pago(500_000, 30, compromisos, [], HOY)
        assert f.comprometido == 0

    def test_la_holgura_es_el_saldo_menos_lo_comprometido(self):
        f = flujo_hasta_el_pago(500_000, 30, [Compromiso("Luz", 40_000, date(2026, 10, 15))],
                                [], HOY)
        assert f.holgura == 460_000

    def test_proyecta_el_saldo_al_dia_de_pago(self):
        # 18 días hasta el 30, a 10.000 diarios de gasto variable.
        f = flujo_hasta_el_pago(500_000, 30, [], DIEZ_MIL_AL_DIA, HOY)
        assert f.dias == 18
        assert f.gasto_estimado == 180_000
        assert f.proyectado == 320_000

    def test_el_gasto_variable_y_los_compromisos_se_suman_sin_repetirse(self):
        f = flujo_hasta_el_pago(
            500_000, 30,
            [Compromiso("Internet", 25_000, date(2026, 10, 15))],
            DIEZ_MIL_AL_DIA, HOY,
        )
        assert f.proyectado == 500_000 - 25_000 - 180_000

    def test_avisa_cuando_no_alcanza(self):
        f = flujo_hasta_el_pago(50_000, 30, [], DIEZ_MIL_AL_DIA, HOY)
        assert f.proyectado < 0

    def test_informa_cuanto_historial_la_respalda(self):
        # Sin esto la pantalla no puede decir si la estimación es firme o floja.
        f = flujo_hasta_el_pago(500_000, 30, [], [300_000, 290_000], HOY)
        assert f.meses_observados == 2


class TestAbstencion:
    def test_sin_dia_de_pago_no_proyecta(self):
        # No se inventa un horizonte: una fecha falsa produce un "te alcanza"
        # que suena preciso y no lo es.
        assert flujo_hasta_el_pago(500_000, None, [], DIEZ_MIL_AL_DIA, HOY) is None

    def test_un_compromiso_sin_fecha_no_se_ubica_en_el_ciclo(self):
        f = flujo_hasta_el_pago(500_000, 30, [Compromiso("Algo", 50_000, None)], [], HOY)
        assert f.comprometido == 0

    def test_sin_historial_el_gasto_estimado_es_cero(self):
        # Se dice "no sé" con un cero explícito, no con una cifra inventada.
        f = flujo_hasta_el_pago(500_000, 30, [], [], HOY)
        assert f.gasto_estimado == 0 and f.meses_observados == 0
