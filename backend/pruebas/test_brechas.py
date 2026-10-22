# -*- coding: utf-8 -*-
"""
Pruebas del plazo de notificación de brechas.

Lo que se verifica no son números bonitos sino las dos reglas que es fácil
implementar mal: que el reloj parta cuando se DETECTA y no cuando ocurre el
hecho, y que al vencer el plazo el contador no se congele en cero.
"""
from datetime import datetime, timedelta, timezone

from motor.brechas import HORAS_DE_PLAZO, describir, plazo_de

UTC = timezone.utc
DETECTADO = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)


class TestInicioDelPlazo:
    def test_vence_72_horas_despues_de_detectarlo(self):
        p = plazo_de(DETECTADO, ahora=DETECTADO)
        assert p.vence_at == DETECTADO + timedelta(hours=HORAS_DE_PLAZO)
        assert p.horas_restantes == 72

    def test_el_reloj_parte_al_detectar_no_al_ocurrir(self):
        # El hecho pasó hace tres semanas; se descubrió hoy. El plazo es desde hoy.
        # La funcion solo recibe la deteccion, justamente para que no se pueda
        # confundir una fecha con la otra.
        p = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=1))
        assert p.horas_restantes == 71
        assert p.vencido is False


class TestUrgencia:
    def test_recien_detectado_esta_holgado(self):
        assert plazo_de(DETECTADO, ahora=DETECTADO).urgencia == "holgado"

    def test_a_menos_de_un_dia_se_vuelve_urgente(self):
        p = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=50))
        assert p.urgencia == "urgente"
        assert p.vencido is False

    def test_justo_en_el_limite_de_24_horas_ya_es_urgente(self):
        p = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=48))
        assert p.horas_restantes == 24
        assert p.urgencia == "urgente"

    def test_pasado_el_plazo_queda_vencido(self):
        p = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=73))
        assert p.vencido is True
        assert p.urgencia == "vencido"


class TestElRelojNoSeCongela:
    def test_el_atraso_sigue_creciendo(self):
        un_dia = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=96))
        dos_dias = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=120))
        # Si el contador se detuviera al vencer, estos dos serían iguales y se
        # perdería la magnitud del incumplimiento.
        assert dos_dias.horas_restantes < un_dia.horas_restantes
        assert describir(un_dia) == "Plazo vencido hace 1 día"
        assert describir(dos_dias) == "Plazo vencido hace 2 días"


class TestYaNotificado:
    def test_notificar_dentro_del_plazo_queda_cumplido(self):
        p = plazo_de(DETECTADO, notificado_at=DETECTADO + timedelta(hours=10))
        assert p.urgencia == "cumplido"
        assert p.vencido is False
        assert describir(p) == "Notificado dentro del plazo"

    def test_notificar_despues_queda_marcado_como_tardio(self):
        p = plazo_de(DETECTADO, notificado_at=DETECTADO + timedelta(hours=100))
        assert p.urgencia == "tardio"
        assert p.vencido is True
        assert describir(p) == "Notificado fuera de plazo"

    def test_notificar_justo_en_el_limite_cuenta_como_a_tiempo(self):
        p = plazo_de(DETECTADO, notificado_at=DETECTADO + timedelta(hours=HORAS_DE_PLAZO))
        assert p.urgencia == "cumplido"


class TestRedaccion:
    def test_dice_horas_cuando_queda_menos_de_un_dia(self):
        p = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=69))
        assert describir(p) == "Quedan 3 horas para notificar"

    def test_dice_dias_cuando_queda_mas(self):
        p = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=24))
        assert describir(p) == "Quedan 2 días para notificar"

    def test_nunca_dice_cero_minutos(self):
        p = plazo_de(DETECTADO, ahora=DETECTADO + timedelta(hours=71, minutes=59, seconds=55))
        assert "0 minuto" not in describir(p)
