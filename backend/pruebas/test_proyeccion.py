# -*- coding: utf-8 -*-
"""
Pruebas del motor de proyección de metas.

Una simulación aleatoria se puede probar porque el generador está sembrado: la
misma entrada da siempre la misma salida. Lo que se verifica acá no es un
número mágico, sino las propiedades que la proyección tiene que cumplir sí o sí
— que la curva nunca baje, que más plata ahorrada nunca empeore el pronóstico,
que el motor se abstenga cuando no tiene con qué.
"""
import pytest

from motor.proyeccion import (
    HORIZONTE_MESES,
    MINIMO_MESES,
    excedentes_observados,
    proyectar,
)

# Seis meses de excedente, como los que deja un sueldo de 850.000 con un gasto
# que se mueve entre 600.000 y 750.000.
EXCEDENTES = [250_000.0, 180_000.0, 220_000.0, 100_000.0, 300_000.0, 150_000.0]


class TestExcedentesObservados:
    def test_descuenta_el_gasto_del_ingreso(self):
        gastos = {"2026-08": 600_000.0, "2026-09": 700_000.0}
        assert excedentes_observados(gastos, 850_000.0, "2026-10") == [250_000.0, 150_000.0]

    def test_deja_fuera_el_mes_en_curso_por_ir_a_medias(self):
        # Octubre lleva gastados 100.000 porque recién empieza. Si entrara,
        # aportaría un excedente de 750.000 y falsearía toda la proyección.
        gastos = {"2026-08": 600_000.0, "2026-09": 700_000.0, "2026-10": 100_000.0}
        assert excedentes_observados(gastos, 850_000.0, "2026-10") == [250_000.0, 150_000.0]

    def test_un_mes_de_gasto_mayor_al_ingreso_da_excedente_negativo(self):
        # No se recorta a cero: un mes en que se gastó de más es información,
        # y es justamente lo que hace que la proyección no sea optimista.
        assert excedentes_observados({"2026-08": 900_000.0}, 850_000.0, "2026-10") == [-50_000.0]


class TestAbstencion:
    @pytest.mark.parametrize("cuantos", range(MINIMO_MESES))
    def test_no_proyecta_con_menos_del_minimo_de_meses(self, cuantos):
        p = proyectar(EXCEDENTES[:cuantos], ahorro_actual=0, objetivo=500_000)
        assert p.estado == "sin_historial"
        assert p.meses_p80 is None
        assert p.curva == ()

    def test_con_el_minimo_ya_proyecta(self):
        p = proyectar(EXCEDENTES[:MINIMO_MESES], ahorro_actual=0, objetivo=500_000)
        assert p.estado == "proyectada"

    def test_la_meta_ya_alcanzada_no_se_simula(self):
        p = proyectar(EXCEDENTES, ahorro_actual=600_000, objetivo=500_000)
        assert p.estado == "cumplida"
        assert p.meses_p50 is None

    def test_sin_excedente_la_meta_es_improbable(self):
        # Seis meses sin sobrar nada: la simulación corre, pero ningún futuro
        # llega. El motor lo dice en vez de devolver un plazo cualquiera.
        p = proyectar([0.0, -10_000.0, 0.0, -5_000.0, 0.0, -20_000.0], 0, 500_000)
        assert p.estado == "improbable"
        assert p.meses_p50 is None
        assert max(p.curva) == 0.0


class TestCurva:
    def test_la_curva_nunca_baja(self):
        # Es probabilidad acumulada: la meta no se puede "desalcanzar".
        p = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        assert all(b >= a for a, b in zip(p.curva, p.curva[1:]))

    def test_la_curva_cubre_todo_el_horizonte(self):
        p = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        assert len(p.curva) == HORIZONTE_MESES

    def test_las_probabilidades_estan_entre_cero_y_uno(self):
        p = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        assert all(0.0 <= x <= 1.0 for x in p.curva)

    def test_los_percentiles_van_en_orden(self):
        # Estar más seguro cuesta más tiempo. Nunca al revés.
        p = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        assert p.meses_p50 <= p.meses_p80 <= p.meses_p95

    def test_el_percentil_corresponde_a_la_curva(self):
        p = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        # En el mes que informa, la probabilidad ya llegó al 80%.
        assert p.curva[p.meses_p80 - 1] >= 0.80
        # Y en el mes anterior todavía no, o sería ese el que informa.
        assert p.curva[p.meses_p80 - 2] < 0.80


class TestSensibilidad:
    def test_mas_ahorrado_nunca_empeora_el_plazo(self):
        sin = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        con = proyectar(EXCEDENTES, ahorro_actual=400_000, objetivo=1_000_000)
        assert con.meses_p80 <= sin.meses_p80

    def test_una_meta_mas_cara_nunca_llega_antes(self):
        barata = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=500_000)
        cara = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=2_000_000)
        assert cara.meses_p80 >= barata.meses_p80

    def test_un_historial_mas_holgado_acorta_el_plazo(self):
        apretado = proyectar([50_000.0] * 6, ahorro_actual=0, objetivo=600_000)
        holgado = proyectar([200_000.0] * 6, ahorro_actual=0, objetivo=600_000)
        assert holgado.meses_p80 < apretado.meses_p80

    def test_la_meta_fuera_del_horizonte_no_inventa_un_plazo(self):
        p = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=100_000_000)
        assert p.meses_p50 is None
        assert p.estado == "improbable"


class TestReproducibilidad:
    def test_la_misma_entrada_da_la_misma_salida(self):
        # Sin esto la simulación no sería verificable, y un motor de dinero que
        # no se puede verificar no sirve.
        a = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        b = proyectar(EXCEDENTES, ahorro_actual=0, objetivo=1_000_000)
        assert a == b

    def test_otra_semilla_mueve_el_resultado_poco(self):
        # Que cambie algo confirma que de verdad hay azar; que cambie poco
        # confirma que 10.000 simulaciones bastan para que el ruido no mande.
        a = proyectar(EXCEDENTES, 0, 1_000_000, semilla=1)
        b = proyectar(EXCEDENTES, 0, 1_000_000, semilla=2)
        assert abs(a.curva[11] - b.curva[11]) < 0.02


class TestVariabilidad:
    def test_el_riesgo_se_nota_aunque_el_promedio_sea_el_mismo(self):
        """
        El argumento central del motor: dos personas con el mismo excedente
        promedio no tienen la misma certeza.

        Las dos promedian 150.000 al mes. La primera los tiene todos los meses;
        la segunda alterna meses buenos con meses en cero. A la segunda le
        cuesta más estar segura, y una división por el promedio no vería
        ninguna diferencia entre ambas.
        """
        parejo = proyectar([150_000.0] * 6, 0, 900_000)
        disparejo = proyectar([300_000.0, 0.0] * 3, 0, 900_000)

        assert parejo.excedente_mediano == 150_000.0
        assert sum([300_000.0, 0.0] * 3) / 6 == 150_000.0
        # Mismo promedio, más meses necesarios para la misma seguridad.
        assert disparejo.meses_p95 > parejo.meses_p95
