# -*- coding: utf-8 -*-
"""
Pruebas del detector de sueldo.

Lo que se verifica no es solo que acierte, sino que SEPA CALLARSE. El monto que
este motor propone termina alimentando la proyección Monte Carlo de las metas,
así que una propuesta equivocada no se queda en una pantalla: se convierte en
una fecha de compra que no se va a cumplir. Por eso hay tantas pruebas de
abstención como de acierto.
"""
import calendar
from datetime import date

from motor.sueldo import Abono, detectar


def el(anio, mes, dia=30):
    """Ese día del mes, o el último si el mes es más corto (febrero)."""
    return date(anio, mes, min(dia, calendar.monthrange(anio, mes)[1]))


def mensual(glosa, monto, meses, anio=2026, desde=1, dia=30):
    """Un abono por mes, con la misma glosa."""
    return [Abono(fecha=el(anio, desde + i, dia), glosa=glosa, monto=monto)
            for i in range(meses)]


class TestDeteccion:
    def test_encuentra_el_abono_que_se_repite(self):
        s = detectar(mensual("Abono de remuneracion", 850_000, 6))
        assert s is not None
        assert s.monto == 850_000
        assert s.meses == 6
        assert s.glosa == "Abono de remuneracion"

    def test_informa_el_periodo_observado(self):
        s = detectar(mensual("Sueldo", 500_000, 4, desde=2))
        assert s.desde == date(2026, 2, 28)  # febrero no tiene 30
        assert s.hasta == date(2026, 5, 30)

    def test_agrupa_aunque_el_banco_cambie_el_texto(self):
        # Mismo empleador, glosa con número de lote distinto cada mes.
        abonos = [
            Abono(date(2026, m, 30), f"ABONO REMUNERACION {1000 + m}", 700_000)
            for m in (6, 7, 8, 9)
        ]
        s = detectar(abonos)
        assert s is not None and s.meses == 4

    def test_usa_la_glosa_mas_reciente(self):
        abonos = [
            Abono(date(2026, 6, 30), "ABONO REMUNERACION 1", 700_000),
            Abono(date(2026, 7, 30), "ABONO REMUNERACION 2", 700_000),
            Abono(date(2026, 8, 30), "ABONO REMUNERACION 3", 700_000),
        ]
        assert detectar(abonos).glosa == "ABONO REMUNERACION 3"


class TestAbstencion:
    def test_sin_abonos_no_propone_nada(self):
        assert detectar([]) is None

    def test_un_abono_suelto_no_es_sueldo(self):
        assert detectar([Abono(date(2026, 9, 30), "Devolucion SII", 320_000)]) is None

    def test_dos_meses_todavia_no_alcanzan(self):
        assert detectar(mensual("Sueldo", 600_000, 2)) is None

    def test_varios_abonos_del_mismo_mes_no_hacen_patron(self):
        # Tres abonos iguales en septiembre: es un mes, no tres.
        abonos = [Abono(date(2026, 9, d), "Honorarios", 200_000) for d in (5, 15, 25)]
        assert detectar(abonos) is None

    def test_ignora_montos_negativos(self):
        cargos = [Abono(date(2026, m, 10), "Arriendo", -450_000) for m in (6, 7, 8)]
        assert detectar(cargos) is None


class TestElegirEntreCandidatos:
    def test_gana_el_que_aparece_en_mas_meses(self):
        abonos = mensual("Sueldo", 400_000, 6) + mensual("Arriendo que cobro", 900_000, 3)
        s = detectar(abonos)
        assert s.monto == 400_000 and s.meses == 6

    def test_empatados_en_meses_gana_el_monto_mayor(self):
        # Un reembolso mensual chico no debe pasar por sueldo.
        abonos = mensual("Sueldo", 850_000, 4) + mensual("Reembolso colacion", 60_000, 4)
        assert detectar(abonos).monto == 850_000


class TestMonto:
    def test_usa_la_mediana_y_no_el_promedio(self):
        # Diciembre con aguinaldo: el promedio daría 1.000.000 y propondría de
        # más justo en el dato que alimenta la proyección de metas.
        abonos = mensual("Sueldo", 800_000, 5)
        abonos.append(Abono(date(2026, 12, 30), "Sueldo", 1_800_000))
        assert detectar(abonos).monto == 800_000

    def test_tolera_variaciones_chicas_del_liquido(self):
        montos = [812_340, 809_990, 815_200, 810_500, 811_000]
        abonos = [
            Abono(date(2026, 5 + i, 30), "Abono de remuneracion", m)
            for i, m in enumerate(montos)
        ]
        s = detectar(abonos)
        assert s.monto == 811_000  # la mediana, un líquido real de la serie
