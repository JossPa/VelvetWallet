# -*- coding: utf-8 -*-
"""
Pruebas del asistente conversacional (asesor/).

No llaman a Groq ni a la base de datos. El modelo se reemplaza por un doble
que responde un guion fijo —"primero pide tal herramienta, después contesta
tal texto"— y las herramientas por un registro de llamadas. Lo que se prueba
es lo que es nuestro: que el ciclo ejecute lo que el modelo pide, que le
devuelva el resultado, que no se rompa con argumentos basura y que los
resúmenes no dejen pasar campos ambiguos ni identificadores.
"""
import json
from datetime import date
from types import SimpleNamespace as NS

import pytest

from asesor import conversacion, herramientas
from asesor.conversacion import AsistenteNoDisponible, limpiar, responder, responder_con_respaldo

HOY = date(2026, 11, 17)


# ── dobles ──────────────────────────────────────────────────────────────────

def llamada(nombre, argumentos, id_="c1"):
    return NS(id=id_, function=NS(name=nombre, arguments=argumentos))


def turno(texto=None, llamadas=None):
    return NS(choices=[NS(message=NS(content=texto, tool_calls=llamadas))])


class ModeloDeGuion:
    """Responde, en orden, los turnos que se le dieron. Guarda lo que recibió."""

    def __init__(self, *turnos):
        self.turnos = list(turnos)
        self.recibido = []
        self.chat = NS(completions=NS(create=self._crear))

    def _crear(self, **kw):
        self.recibido.append(kw)
        return self.turnos.pop(0)


class ModeloCaido:
    chat = NS(completions=NS(create=lambda **kw: (_ for _ in ()).throw(RuntimeError("429"))))


class ErrorDeLlamada(Exception):
    """Lo que devuelve Groq cuando el modelo inventa el nombre de una herramienta."""

    def __init__(self):
        super().__init__("Error code: 400 - {'code': 'tool_use_failed', 'failed_generation': "
                         "'{\"name\": \"fluxo_de_caja\"}'}")


class ModeloConTropiezos(ModeloDeGuion):
    """Como ModeloDeGuion, pero un turno puede ser una excepción a lanzar."""

    def _crear(self, **kw):
        self.recibido.append(kw)
        siguiente = self.turnos.pop(0)
        if isinstance(siguiente, Exception):
            raise siguiente
        return siguiente


class HerramientasFalsas:
    def __init__(self, resultado=None):
        self.llamadas = []
        self.resultado = resultado or {"llegas_al_dia_de_pago_con": 755_591}

    def ejecutar(self, nombre, argumentos):
        self.llamadas.append((nombre, argumentos))
        return self.resultado


PREGUNTA = [{"rol": "usuario", "texto": "¿con cuánto llego al día de pago?"}]


# ── el ciclo ────────────────────────────────────────────────────────────────

def test_ejecuta_la_herramienta_y_le_devuelve_el_resultado_al_modelo():
    modelo = ModeloDeGuion(
        turno(llamadas=[llamada("flujo_de_caja", "{}")]),
        turno("Llegas al día de pago con $755.591."),
    )
    h = HerramientasFalsas()

    r = responder(modelo, "m", h, PREGUNTA, HOY)

    assert r.texto == "Llegas al día de pago con $755.591."
    assert r.consultas == ["Flujo de caja"]
    assert h.llamadas == [("flujo_de_caja", {})]
    # El segundo pedido al modelo lleva el resultado de la herramienta.
    ultimo = modelo.recibido[1]["messages"][-1]
    assert ultimo["role"] == "tool" and json.loads(ultimo["content"]) == h.resultado


def test_responde_sin_herramientas_cuando_no_hacen_falta():
    modelo = ModeloDeGuion(turno("No doy asesoría de inversión."))
    h = HerramientasFalsas()

    r = responder(modelo, "m", h, [{"rol": "usuario", "texto": "¿en qué fondo invierto?"}], HOY)

    assert r.texto == "No doy asesoría de inversión." and r.consultas == [] and h.llamadas == []


def test_argumentos_que_no_son_json_no_rompen_el_ciclo():
    modelo = ModeloDeGuion(turno(llamadas=[llamada("metas", "{esto no es json")]), turno("Listo."))
    h = HerramientasFalsas()

    assert responder(modelo, "m", h, PREGUNTA, HOY).texto == "Listo."
    assert h.llamadas == [("metas", {})]


def test_no_gira_para_siempre():
    pedidos = [turno(llamadas=[llamada("metas", "{}", f"c{i}")]) for i in range(10)]
    modelo = ModeloDeGuion(*pedidos)

    r = responder(modelo, "m", HerramientasFalsas(), PREGUNTA, HOY)

    assert len(modelo.recibido) == conversacion.VUELTAS_MAXIMAS
    assert "otra forma" in r.texto


def test_si_el_proveedor_falla_se_avisa_en_vez_de_inventar():
    with pytest.raises(AsistenteNoDisponible):
        responder(ModeloCaido(), "m", HerramientasFalsas(), PREGUNTA, HOY)


def test_solo_manda_el_historial_reciente_y_las_instrucciones_primero():
    historial = [{"rol": "usuario" if i % 2 == 0 else "asistente", "texto": f"m{i}"} for i in range(25)]
    modelo = ModeloDeGuion(turno("ok"))

    responder(modelo, "m", HerramientasFalsas(), historial, HOY)

    enviados = modelo.recibido[0]["messages"]
    assert enviados[0]["role"] == "system" and "17 de noviembre de 2026" in enviados[0]["content"]
    assert len(enviados) == 1 + conversacion.MENSAJES_DE_CONTEXTO
    assert enviados[-1]["content"] == "m24"


def test_las_instrucciones_prohiben_calcular_y_asesorar():
    texto = conversacion.instrucciones(HOY)
    assert "Nunca sumes" in texto and "asesoría de inversión" in texto


@pytest.mark.parametrize("crudo, limpio", [
    ("Gastaste **$272.055** en Vestuario.", "Gastaste $272.055 en Vestuario."),
    ("- Vivienda\n- Supermercado", "Vivienda\nSupermercado"),
    ("## Resumen\nTodo bien", "Resumen\nTodo bien"),
    ('Gastaste un total de "$524.279" en Falabella.', "Gastaste un total de $524.279 en Falabella."),
    ("Llegarías con “-$94.409”.", "Llegarías con -$94.409."),
])
def test_quita_el_formato_markdown(crudo, limpio):
    assert limpiar(crudo) == limpio


# ── las herramientas ────────────────────────────────────────────────────────

def test_filtra_argumentos_que_la_herramienta_no_conoce():
    def gasto_por_categoria(mes, categorias=None):
        return mes

    assert herramientas.filtrar_argumentos(gasto_por_categoria, {"mes": "2026-10", "": {}, "x": 1}) \
        == {"mes": "2026-10"}


def test_herramienta_inexistente_devuelve_error_como_dato():
    h = herramientas.Herramientas("usuario-1", HOY)
    assert "error" in h.ejecutar("borrar_todo", {})


def test_definiciones_y_titulos_calzan():
    nombres = {d["function"]["name"] for d in herramientas.DEFINICIONES}
    assert nombres == set(herramientas.TITULOS)
    # Ninguna herramienta recibe un id de usuario: el modelo no puede pedir datos de otro.
    for d in herramientas.DEFINICIONES:
        assert not any("usuario" in p or p.endswith("id") for p in d["function"]["parameters"]["properties"])


FLUJO = {
    "excedente": {"ingreso": 850000, "gastosFijos": 386053, "cuotas": 148900, "excedente": 315047,
                  "ingresoConocido": True},
    "flujo": {"saldo": 945486, "proximoPago": "2026-11-30", "dias": 13, "comprometido": 22560,
              "holgura": 922926, "gastoEstimado": 167335, "proyectado": 755591, "mesesObservados": 12,
              "proximosCargos": [{"nombre": "Spotify", "monto": 5990, "fecha": "2026-11-20"}]},
}


def test_flujo_con_nombres_que_no_admiten_dos_lecturas():
    # El defecto de la primera prueba: el modelo leyó `holgura` como "con cuánto
    # llego al día de pago". El resumen deja la respuesta con su propio nombre.
    r = herramientas.resumir_flujo(FLUJO)
    assert r["llegas_al_dia_de_pago_con"] == 755_591
    assert r["libre_hoy"] == 922_926
    assert "holgura" not in json.dumps(r) and "proyectado" not in json.dumps(r)


def test_flujo_sin_sueldo_no_inventa_dia_de_pago():
    r = herramientas.resumir_flujo({**FLUJO, "flujo": None})
    assert "No se conoce" in r["dia_de_pago"] and "llegas_al_dia_de_pago_con" not in r


def test_recurrentes_sin_descartados_ni_identificadores():
    r = herramientas.resumir_recurrentes({
        "comprometidoAlMes": 278300,
        "suscripciones": [
            {"id": "uuid-1", "nombre": "Inmobiliaria Los Robles", "periodicidad": "mensual",
             "montoEsperado": 268400.0, "proximaFecha": "2026-12-05", "estado": "confirmada"},
            {"id": "uuid-2", "nombre": "Netflix", "periodicidad": "mensual",
             "montoEsperado": 9900.0, "proximaFecha": "2026-11-28", "estado": "detectada"},
            {"id": "uuid-3", "nombre": "iCloud", "periodicidad": "mensual",
             "montoEsperado": 2700.0, "proximaFecha": None, "estado": "descartada"},
        ],
    })
    assert [c["nombre"] for c in r["cobros"]] == ["Inmobiliaria Los Robles", "Netflix"]
    assert r["total_mensual_comprometido"] == 278_300
    assert "uuid" not in json.dumps(r)


def test_metas_dan_el_plazo_con_80_y_95_por_ciento():
    r = herramientas.resumir_metas({"metas": [
        {"id": "x", "nombre": "Nintendo Switch 2", "montoObjetivo": 400000.0, "montoAhorrado": 350000.0,
         "avance": 0.875, "proyeccion": {"mesesP50": 2, "mesesP80": 3, "mesesP95": 5, "simulaciones": 10000}},
        {"id": "y", "nombre": "Viaje", "montoObjetivo": 900000.0, "montoAhorrado": 0.0,
         "avance": 0, "proyeccion": None},
    ]})["metas"]
    assert r[0]["meses_con_80_por_ciento_de_probabilidad"] == 3
    assert r[0]["meses_con_95_por_ciento_de_probabilidad"] == 5
    assert "P50" not in json.dumps(r) and "id" not in r[0]
    assert "Sin proyección" in r[1]["proyeccion"]


def test_creditos_solo_vigentes():
    r = herramientas.resumir_creditos({
        "cuotaTotalMensual": 148900, "saldoTotal": 1200000,
        "creditos": [
            {"producto": "Crédito de consumo", "cuotaMensual": 148900.0, "cuotasRestantes": 8,
             "saldoActual": 1200000.0},
            {"producto": "Avance pagado", "cuotaMensual": 50000.0, "cuotasRestantes": 0, "saldoActual": 0.0},
        ],
    })
    assert [c["producto"] for c in r["creditos"]] == ["Crédito de consumo"]


# ── herramientas nuevas ─────────────────────────────────────────────────────

def test_puedes_gastar_por_dia_lo_calcula_el_codigo():
    # 922.926 libres en 13 días: 70.994 al día, truncado hacia abajo.
    assert herramientas.resumir_flujo(FLUJO)["puedes_gastar_por_dia_para_llegar_en_cero"] == 70_994


@pytest.mark.parametrize("monto, veredicto", [
    (80_000, "alcanza"),            # bajo lo que se proyecta al día de pago (755.591)
    (800_000, "alcanza_justo"),     # está libre hoy (922.926), pero se llegaría en negativo
    (1_000_000, "no_alcanza"),      # ni siquiera está libre hoy
])
def test_me_alcanza_decide_el_veredicto_en_el_codigo(monto, veredicto):
    r = herramientas.evaluar_compra(herramientas.resumir_flujo(FLUJO), monto)
    assert r["veredicto"] == veredicto
    assert r["si_compras"]["llegarias_al_dia_de_pago_con"] == 755_591 - monto
    assert r["si_no_compras"]["llegarias_al_dia_de_pago_con"] == 755_591


def test_me_alcanza_justo_redacta_la_comparacion_sin_cruzar_escenarios():
    # El modelo cruzó "con" y "sin" la compra; la frase ahora la escribe el código.
    r = herramientas.evaluar_compra(herramientas.resumir_flujo(FLUJO), 850_000)
    assert r["respuesta_sugerida"] == ("Te alcanza justo: hoy tienes la plata, pero con lo que sueles "
                                       "gastar llegarías al día de pago con -$94.409.")


def test_me_alcanza_sin_dia_de_pago_no_inventa():
    r = herramientas.evaluar_compra(herramientas.resumir_flujo({**FLUJO, "flujo": None}), 10_000)
    assert "sin_dato" in r


def test_recurrentes_anualiza_y_suma_los_pedidos_en_el_codigo():
    r = herramientas.resumir_recurrentes({
        "comprometidoAlMes": 16_790,
        "suscripciones": [
            {"nombre": "Netflix", "periodicidad": "mensual", "montoEsperado": 9900.0,
             "proximaFecha": None, "estado": "confirmada"},
            {"nombre": "Spotify", "periodicidad": "mensual", "montoEsperado": 5990.0,
             "proximaFecha": None, "estado": "detectada"},
            {"nombre": "Dominio web", "periodicidad": "anual", "montoEsperado": 10800.0,
             "proximaFecha": None, "estado": "detectada"},
        ],
    }, nombres=["netflix", "SPOTIFY"])
    assert r["cobros_pedidos"] == {"encontrados": ["Netflix", "Spotify"],
                                   "subtotal_mensual": 15_890, "subtotal_anual": 190_680}
    assert r["total_anual_comprometido"] == 201_480
    dominio = next(c for c in r["cobros"] if c["nombre"] == "Dominio web")
    assert dominio["equivale_al_mes"] == 900 and dominio["equivale_al_anio"] == 10_800


def test_metas_dicen_cuanto_falta_y_si_ya_se_cumplio():
    r = herramientas.resumir_metas({"metas": [
        {"nombre": "Switch", "montoObjetivo": 400000.0, "montoAhorrado": 350000.0, "avance": 0.875,
         "proyeccion": {"mesesP80": 3, "mesesP95": 5, "simulaciones": 10000}},
        {"nombre": "Audífonos", "montoObjetivo": 50000.0, "montoAhorrado": 60000.0, "avance": 1,
         "proyeccion": {"estado": "cumplida", "mesesP80": None}},
    ]})["metas"]
    assert r[0]["falta"] == 50_000
    assert r[1]["falta"] == 0 and "cumplida" in r[1]["proyeccion"]


EXCEDENTES = [36_000, -60_000, 227_000, 15_000, 80_000, 40_000, 10_000, 120_000, -20_000, 55_000]


def test_simulacion_base_es_la_misma_que_ve_la_pantalla_de_metas():
    from motor.proyeccion import proyectar

    r = herramientas.simular_ahorro_extra(EXCEDENTES, 100_000, 600_000, 50_000)
    pantalla = proyectar(EXCEDENTES, ahorro_actual=100_000, objetivo=600_000)
    assert r["plazo_actual"]["meses_con_80_por_ciento"] == pantalla.meses_p80


def test_ahorrar_mas_acorta_el_plazo_y_ahorrar_menos_lo_alarga():
    mas = herramientas.simular_ahorro_extra(EXCEDENTES, 100_000, 600_000, 50_000)
    menos = herramientas.simular_ahorro_extra(EXCEDENTES, 100_000, 600_000, -20_000)
    hoy = mas["plazo_actual"]["meses_con_80_por_ciento"]
    assert mas["plazo_con_el_cambio"]["meses_con_80_por_ciento"] < hoy
    # Ahorrando menos, o tarda más, o ya no se alcanza dentro de lo simulado;
    # en ese caso lo dice en vez de inventar un plazo.
    peor = menos["plazo_con_el_cambio"]
    assert peor.get("meses_con_80_por_ciento", 99) > hoy
    if "estado" in peor:
        assert "no se alcanza" in peor["estado"]


def test_simulacion_sin_historial_lo_dice():
    r = herramientas.simular_ahorro_extra([50_000, 40_000], 0, 500_000, 30_000)
    assert "sin historial" in r["plazo_con_el_cambio"]["estado"]


def test_la_comparacion_de_escenarios_la_redacta_el_codigo():
    # El modelo dijo "15 meses" (el plazo actual) para un ahorro menor que ya no alcanzaba.
    menos = herramientas.simular_ahorro_extra(EXCEDENTES, 100_000, 600_000, -20_000)
    actual = menos["plazo_actual"]["meses_con_80_por_ciento"]
    assert menos["respuesta_sugerida"].startswith(f"Hoy la juntarías en {actual} meses con 80% de probabilidad; "
                                                  "ahorrando $20.000 menos al mes, ")
    mas = herramientas.simular_ahorro_extra(EXCEDENTES, 100_000, 600_000, 50_000)
    nuevo = mas["plazo_con_el_cambio"]["meses_con_80_por_ciento"]
    assert mas["respuesta_sugerida"].endswith(f"ahorrando $50.000 más al mes, la juntarías en {nuevo} meses "
                                              "con 80% de probabilidad.")


@pytest.mark.parametrize("dia, cuotas, esperado", [
    (5, 3, "2027-02-05"),     # próximo pago 5-dic, luego ene y feb
    (31, 4, "2027-02-28"),    # nov-30, dic-31, ene-31, feb-28: el 31 se corre al último día
    (5, 1, "2026-12-05"),
    (None, 3, None),
])
def test_fecha_de_la_ultima_cuota(dia, cuotas, esperado):
    assert herramientas.fecha_ultima_cuota(dia, cuotas, HOY) == esperado


# ── defectos encontrados al probar con el modelo real (17-nov) ──────────────

def test_los_montos_le_llegan_al_modelo_ya_escritos():
    # El modelo recibió 118800 y escribió "$11.880". Ahora recibe el texto.
    r = herramientas.montos_escritos({
        "cobros_pedidos": {"subtotal_anual": 190_680},
        "cobros": [{"nombre": "Netflix", "equivale_al_anio": 118_800}],
        "por_mes": [{"mes": "2026-10", "monto": -60_332, "compras": 5}],
    })
    assert r["cobros_pedidos"]["subtotal_anual"] == "$190.680"
    assert r["cobros"][0]["equivale_al_anio"] == "$118.800"
    assert r["por_mes"][0] == {"mes": "2026-10", "monto": "-$60.332", "compras": 5}


def test_lo_que_no_es_plata_sigue_siendo_numero():
    r = herramientas.montos_escritos({"dias_que_faltan": 13, "cuotas_restantes": 22, "avance_pct": 88,
                                      "meses_con_80_por_ciento_de_probabilidad": 3, "cambio_pct": -75,
                                      "sueldo_conocido": True, "cuotas": 148_900})
    assert r == {"dias_que_faltan": 13, "cuotas_restantes": 22, "avance_pct": 88,
                 "meses_con_80_por_ciento_de_probabilidad": 3, "cambio_pct": -75,
                 "sueldo_conocido": True, "cuotas": "$148.900"}


def test_los_opcionales_aceptan_null_y_los_obligatorios_no():
    # "¿cuánto gasto en promedio?" falló porque el modelo mandó categoria=null
    # y el proveedor rechazó la llamada por no calzar con el esquema.
    for d in herramientas.DEFINICIONES:
        p = d["function"]["parameters"]
        for nombre, prop in p["properties"].items():
            if nombre in p["required"]:
                assert "null" not in prop["type"], (d["function"]["name"], nombre)
            else:
                assert "null" in prop["type"], (d["function"]["name"], nombre)


def test_un_null_del_modelo_equivale_a_no_mandar_el_argumento():
    class Registro(herramientas.Herramientas):
        def promedio_mensual(self, categoria=None):
            return {"categoria_recibida": categoria}

    assert Registro("u", HOY).ejecutar("promedio_mensual", {"categoria": None}) == {"categoria_recibida": None}


@pytest.mark.parametrize("dicho, esperado", [
    ("la switch", ["Nintendo Switch 2"]),
    ("mi viaje", ["Viaje al sur"]),
    ("Nintendo", ["Nintendo Switch 2"]),
    ("auto", []),
])
def test_la_meta_se_reconoce_por_palabras(dicho, esperado):
    metas = [{"nombre": "Nintendo Switch 2"}, {"nombre": "Viaje al sur"}]
    assert [m["nombre"] for m in herramientas.elegir_por_nombre(dicho, metas)] == esperado


def test_la_respuesta_empieza_con_mayuscula():
    assert limpiar("no registras compras en Uber este mes.") == "No registras compras en Uber este mes."


def test_reintenta_si_el_modelo_escribe_mal_la_herramienta():
    # Pasó en la prueba real: "fluxo_de_caja" y "metas" con letras cirílicas.
    modelo = ModeloConTropiezos(
        ErrorDeLlamada(),
        turno(llamadas=[llamada("flujo_de_caja", "{}")]),
        turno("Puedes gastar $70.994 al día."),
    )
    r = responder(modelo, "m", HerramientasFalsas(), PREGUNTA, HOY)
    assert r.texto == "Puedes gastar $70.994 al día." and r.consultas == ["Flujo de caja"]


def test_reintenta_si_la_respuesta_viene_vacia():
    modelo = ModeloConTropiezos(turno(""), turno("Te faltan $650.000."))
    assert responder(modelo, "m", HerramientasFalsas(), PREGUNTA, HOY).texto == "Te faltan $650.000."


def test_si_insiste_en_fallar_se_rinde_y_lo_dice():
    modelo = ModeloConTropiezos(ErrorDeLlamada(), ErrorDeLlamada(), ErrorDeLlamada())
    with pytest.raises(AsistenteNoDisponible):
        responder(modelo, "m", HerramientasFalsas(), PREGUNTA, HOY)
    vacio = ModeloConTropiezos(turno(""), turno(""), turno(""))
    assert responder(vacio, "m", HerramientasFalsas(), PREGUNTA, HOY).texto == conversacion.SIN_RESPUESTA


class ModeloPorNombre:
    """Un proveedor con dos modelos: el principal sin cuota y el de respaldo bien."""

    def __init__(self, sin_cuota: set[str], error="Error code: 429 - rate_limit_exceeded (TPD)"):
        self.sin_cuota, self.error, self.usados = sin_cuota, error, []
        self.chat = NS(completions=NS(create=self._crear))

    def _crear(self, **kw):
        self.usados.append(kw["model"])
        if kw["model"] in self.sin_cuota:
            raise RuntimeError(self.error)
        return turno(f"Respondió {kw['model']}.")


def test_si_el_modelo_principal_se_queda_sin_cuota_responde_el_respaldo():
    # Pasó en las pruebas del 17-nov: 200.000 tokens diarios agotados.
    proveedor = ModeloPorNombre(sin_cuota={"grande"})
    r = responder_con_respaldo(proveedor, ["grande", "chico"], HerramientasFalsas(), PREGUNTA, HOY)
    assert r.texto == "Respondió chico." and proveedor.usados == ["grande", "chico"]


def test_otros_errores_no_se_reintentan_con_otro_modelo():
    proveedor = ModeloPorNombre(sin_cuota={"grande"}, error="Error code: 401 - clave inválida")
    with pytest.raises(AsistenteNoDisponible):
        responder_con_respaldo(proveedor, ["grande", "chico"], HerramientasFalsas(), PREGUNTA, HOY)
    assert proveedor.usados == ["grande"]


def test_si_todos_estan_sin_cuota_se_avisa():
    proveedor = ModeloPorNombre(sin_cuota={"grande", "chico"})
    with pytest.raises(AsistenteNoDisponible):
        responder_con_respaldo(proveedor, ["grande", "chico"], HerramientasFalsas(), PREGUNTA, HOY)
