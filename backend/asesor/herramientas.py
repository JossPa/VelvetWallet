# -*- coding: utf-8 -*-
"""
Herramientas del asistente: lo único que el modelo puede consultar.

Cada herramienta llama a la misma función que usa la pantalla correspondiente
de la app —el flujo de caja, las metas, los gastos recurrentes, los créditos— o
al cálculo de gasto de `motor/gasto.py`, que replica el de la app. Los números
no los produce el modelo: los produce el mismo código que ya está probado.

**Por qué no se le pasa al modelo el JSON de los endpoints tal cual.** En la
primera prueba se hizo así y el asistente respondió mal dos de diez preguntas:
ante "¿con cuánto llego al día de pago?" eligió el campo `holgura` (lo libre
hoy) en vez de `proyectado`. El modelo no calculó mal; leyó mal un nombre
pensado para programadores. Por eso cada respuesta se resume aquí con nombres
que no admiten dos lecturas (`llegas_al_dia_de_pago_con`) y sin los campos que
no responden nada.

**Qué no sale nunca hacia el proveedor del modelo.** Ningún identificador: ni
ids, ni nombre, ni correo, ni RUT, ni la glosa cruda del banco. Solo
categorías, nombres de comercio, montos y fechas, y solo los que la pregunta
necesita. Es lo que la persona autoriza en la finalidad "asistente_ia".

Los resúmenes (`resumir_*`) son funciones puras y se prueban sin base de datos.
"""
from __future__ import annotations

import inspect
import re
from datetime import date

from motor import gasto
from motor.gasto import redondear

# ─────────────────────────── resúmenes (puros) ──────────────────────────────


def resumir_flujo(respuesta: dict) -> dict:
    """GET /api/flujo resumido. Sin sueldo detectado no hay día de pago."""
    e = respuesta["excedente"]
    salida = {
        "excedente_del_mes": {
            "sueldo": redondear(e["ingreso"]),
            "gastos_fijos": redondear(e["gastosFijos"]),
            "cuotas": redondear(e["cuotas"]),
            "te_queda_despues_de_lo_comprometido": redondear(e["excedente"]),
            "sueldo_conocido": e["ingresoConocido"],
        },
    }
    f = respuesta.get("flujo")
    if f is None:
        salida["dia_de_pago"] = "No se conoce: no hay un sueldo detectado en la cuenta."
        return salida
    libre, dias = f["holgura"], f["dias"]
    salida.update({
        "dia_de_pago": f["proximoPago"],
        "dias_que_faltan": dias,
        "saldo_hoy": redondear(f["saldo"]),
        "cargos_que_vienen_antes_del_pago": redondear(f["comprometido"]),
        "libre_hoy": redondear(libre),
        # Lo libre repartido en los días que quedan: gastando eso al día se
        # llega justo en cero. Se trunca hacia abajo para no prometer de más.
        "puedes_gastar_por_dia_para_llegar_en_cero": (int(libre // dias) if dias > 0 and libre > 0 else 0),
        "gasto_variable_estimado_hasta_el_pago": redondear(f["gastoEstimado"]),
        "llegas_al_dia_de_pago_con": redondear(f["proyectado"]),
        "proximos_cargos": [{"nombre": c["nombre"], "monto": redondear(c["monto"]), "fecha": c["fecha"]}
                            for c in f["proximosCargos"]],
    })
    return salida


def evaluar_compra(flujo: dict, monto: float) -> dict:
    """
    "¿Me alcanza para esto?", sobre el flujo ya resumido.

    Tres respuestas posibles, porque "alcanza" tiene dos sentidos:
      · alcanza        después de comprar se sigue llegando al día de pago con
                       plata, contando lo que se suele gastar en el camino.
      · alcanza_justo  la plata está hoy, pero con lo que se suele gastar hasta
                       el sueldo, se llegaría en negativo.
      · no_alcanza     ni siquiera está libre hoy.
    El veredicto lo decide este código; el modelo solo lo dice con palabras.
    """
    monto = abs(float(monto))
    if "libre_hoy" not in flujo:
        return {"sin_dato": "No se puede evaluar: no se conoce el día de pago."}
    libre, llega = flujo["libre_hoy"], flujo["llegas_al_dia_de_pago_con"]
    if monto > libre:
        veredicto = "no_alcanza"
    elif monto > llega:
        veredicto = "alcanza_justo"
    else:
        veredicto = "alcanza"
    # Agrupado por escenario y con la frase ya escrita. En la prueba del 17-nov,
    # con los cuatro números sueltos, el modelo cruzó "con la compra" y "sin la
    # compra". La comparación la redacta este código; el modelo la copia.
    con_compra = {"libre_hoy_te_quedaria": redondear(libre - monto),
                  "llegarias_al_dia_de_pago_con": redondear(llega - monto)}
    sin_compra = {"libre_hoy": libre, "llegarias_al_dia_de_pago_con": llega}
    frase = {
        "alcanza": "Te alcanza: comprando, igual llegas al día de pago con {llega_con}.",
        "alcanza_justo": ("Te alcanza justo: hoy tienes la plata, pero con lo que sueles gastar "
                          "llegarías al día de pago con {llega_con}."),
        "no_alcanza": "No te alcanza: hoy tienes {libre} libres, descontando los cargos que vienen.",
    }[veredicto].format(llega_con=pesos(con_compra["llegarias_al_dia_de_pago_con"]), libre=pesos(libre))
    return {
        "veredicto": veredicto,
        "respuesta_sugerida": frase,
        "monto_de_la_compra": redondear(monto),
        "si_compras": con_compra,
        "si_no_compras": sin_compra,
        "dia_de_pago": flujo["dia_de_pago"],
    }


#: Para llevar cada cobro a su equivalente mensual. Es la misma tabla que usa
#: /api/suscripciones (AL_MES) para el total comprometido.
_AL_MES = {"semanal": 30 / 7, "quincenal": 30 / 15, "mensual": 1.0, "bimestral": 0.5,
           "trimestral": 1 / 3, "anual": 1 / 12}


def resumir_recurrentes(respuesta: dict, nombres: list[str] | None = None) -> dict:
    """
    GET /api/suscripciones resumido. Lo descartado por la persona no cuenta.

    `nombres` pide el subtotal de algunos cobros ("¿cuánto pago al año en
    Netflix y Spotify?"): la suma y la anualización las hace este código.
    """
    activos = [s for s in respuesta["suscripciones"] if s["estado"] != "descartada"]

    def al_mes(s: dict) -> float:
        return (s["montoEsperado"] or 0) * _AL_MES.get(s["periodicidad"] or "", 0)

    salida = {
        "total_mensual_comprometido": redondear(respuesta["comprometidoAlMes"]),
        "total_anual_comprometido": redondear(respuesta["comprometidoAlMes"] * 12),
        "nota": ("Son todos los cobros que se repiten: arriendo, cuentas básicas, gimnasio y "
                 "servicios digitales. No todos son suscripciones."),
        "cobros": [{"nombre": s["nombre"],
                    "monto": redondear(s["montoEsperado"]) if s["montoEsperado"] is not None else None,
                    "periodicidad": s["periodicidad"],
                    "equivale_al_mes": redondear(al_mes(s)),
                    "equivale_al_anio": redondear(al_mes(s) * 12),
                    "proximo_cobro": s["proximaFecha"],
                    "confirmado_por_la_persona": s["estado"] == "confirmada"}
                   for s in activos],
    }
    if nombres:
        pedidos = {gasto._normalizar(n) for n in nombres if n}
        elegidos = [s for s in activos if any(p in gasto._normalizar(s["nombre"]) for p in pedidos)]
        mensual = sum(al_mes(s) for s in elegidos)
        salida["cobros_pedidos"] = {
            "encontrados": [s["nombre"] for s in elegidos],
            "subtotal_mensual": redondear(mensual),
            "subtotal_anual": redondear(mensual * 12),
        }
    return salida


def resumir_metas(respuesta: dict) -> dict:
    """GET /api/metas resumido: plazos con 80% y 95% de probabilidad, no el promedio."""
    salida = []
    for m in respuesta["metas"]:
        p = m.get("proyeccion") or {}
        meta = {
            "meta": m["nombre"],
            "monto_objetivo": redondear(m["montoObjetivo"]),
            "ahorrado": redondear(m["montoAhorrado"]),
            "falta": redondear(max(0.0, m["montoObjetivo"] - m["montoAhorrado"])),
            "avance_pct": redondear(100 * (m.get("avance") or 0)),
        }
        if p.get("mesesP80") is not None:
            meta.update({
                "meses_con_80_por_ciento_de_probabilidad": p["mesesP80"],
                "meses_con_95_por_ciento_de_probabilidad": p.get("mesesP95"),
                "simulaciones": p.get("simulaciones"),
            })
        elif p.get("estado") == "cumplida":
            meta["proyeccion"] = "Meta cumplida: lo ahorrado ya alcanza el objetivo."
        else:
            meta["proyeccion"] = "Sin proyección: falta historial o el excedente no alcanza."
        salida.append(meta)
    return {"metas": salida}


def simular_ahorro_extra(excedentes: list[float], ahorro_actual: float, objetivo: float,
                         extra_mensual: float) -> dict:
    """
    "¿Y si ahorro $X más al mes?": la misma simulación Monte Carlo, dos veces.

    Cada mes observado se desplaza en `extra_mensual` (ahorrar más es gastar
    menos cada mes) y se vuelve a proyectar con la misma semilla que usa la
    pantalla de Metas. Así el escenario base coincide exacto con lo que la
    persona ve en la app, y la diferencia se explica solo por el cambio.
    Acepta un extra negativo: "¿y si ahorro 30 mil menos?".
    """
    from motor.proyeccion import proyectar

    def plazo(p) -> dict:
        if p.estado == "cumplida":
            return {"estado": "ya cumplida"}
        if p.estado == "sin_historial":
            return {"estado": "sin historial suficiente para proyectar"}
        if p.meses_p80 is None:
            return {"estado": f"no se alcanza con 80% de probabilidad dentro de los {p.horizonte_meses} "
                              "meses simulados"}
        return {"meses_con_80_por_ciento": p.meses_p80, "meses_con_95_por_ciento": p.meses_p95}

    def en_palabras(p) -> str:
        if p.estado == "cumplida":
            return "ya la tienes cumplida"
        if p.estado == "sin_historial":
            return "no hay historial suficiente para proyectarla"
        if p.meses_p80 is None:
            return (f"no alcanzarías a juntarla dentro de {p.horizonte_meses} meses "
                    "con 80% de probabilidad")
        meses = "1 mes" if p.meses_p80 == 1 else f"{p.meses_p80} meses"
        return f"la juntarías en {meses} con 80% de probabilidad"

    base = proyectar(excedentes, ahorro_actual=ahorro_actual, objetivo=objetivo)
    con_extra = proyectar([e + extra_mensual for e in excedentes],
                          ahorro_actual=ahorro_actual, objetivo=objetivo)
    # La comparación la redacta este código. En la prueba del 17-nov, con los
    # dos escenarios como datos sueltos, el modelo leyó el actual como si fuera
    # el nuevo: dijo "15 meses" para un ahorro menor que ya no alcanzaba.
    cambio = f"ahorrando {pesos(abs(extra_mensual))} {'más' if extra_mensual >= 0 else 'menos'} al mes"
    return {
        "respuesta_sugerida": f"Hoy {en_palabras(base)}; {cambio}, {en_palabras(con_extra)}.",
        "ahorro_extra_mensual": redondear(extra_mensual),
        "plazo_actual": plazo(base),
        "plazo_con_el_cambio": plazo(con_extra),
        "simulaciones_por_escenario": base.simulaciones,
    }


def fecha_ultima_cuota(dia_de_pago: int | None, cuotas_restantes: int, hoy: date) -> str | None:
    """
    Cuándo se paga la última cuota: la próxima fecha de pago más las que faltan.

    Si el mes de destino es más corto que el día de pago (un 31 en febrero),
    se corre al último día, igual que el día de pago del sueldo.
    """
    import calendar

    from motor.flujo import proximo_pago

    if not dia_de_pago or cuotas_restantes < 1:
        return None
    primera = proximo_pago(dia_de_pago, hoy)
    total = primera.year * 12 + (primera.month - 1) + (cuotas_restantes - 1)
    anio, mes = divmod(total, 12)
    mes += 1
    return date(anio, mes, min(dia_de_pago, calendar.monthrange(anio, mes)[1])).isoformat()


def resumir_creditos(respuesta: dict, hoy: date | None = None) -> dict:
    """GET /api/creditos resumido: solo lo vigente, con la fecha de la última cuota."""
    hoy = hoy or date.today()
    vigentes = [c for c in respuesta["creditos"] if (c.get("cuotasRestantes") or 0) > 0]
    return {
        "cuota_total_mensual": redondear(respuesta["cuotaTotalMensual"]),
        "saldo_total_adeudado": redondear(respuesta["saldoTotal"]),
        "creditos": [{"producto": c["producto"],
                      "cuota_mensual": redondear(c["cuotaMensual"]) if c["cuotaMensual"] is not None else None,
                      "cuotas_restantes": c["cuotasRestantes"],
                      "ultima_cuota": fecha_ultima_cuota(c.get("diaDePago"), c["cuotasRestantes"], hoy),
                      "saldo": redondear(c["saldoActual"]) if c["saldoActual"] is not None else None}
                     for c in vigentes],
        "nota": "El costo total con intereses (CAE) no está calculado en esta versión.",
    }


# ─────────────────────── montos escritos por el código ───────────────────────

#: Campos que son montos en pesos. Todo lo demás —meses, compras, cuotas
#: restantes, porcentajes, días— se deja como número.
_ES_MONTO = re.compile(
    r"^(monto.*|.*total.*|.*subtotal.*|saldo.*|libre_hoy.*|sueldo|gastos_fijos|cuotas|cuota_mensual|"
    r"te_queda.*|llegas?_.*|llegarias_.*|gasto_variable.*|cargos_que_vienen.*|promedio.*|falta|"
    r"ahorrado|equivale_.*|puedes_gastar.*|ahorro_extra.*|mes|mes_referencia)$"
)


def pesos(valor: float) -> str:
    """272055 -> "$272.055"; -60332 -> "-$60.332". Igual que `pesos()` de la app."""
    entero = redondear(valor)
    texto = f"${abs(entero):,}".replace(",", ".")
    return f"-{texto}" if entero < 0 else texto


def montos_escritos(dato, clave: str | None = None):
    """
    Reemplaza cada monto por su texto en pesos chilenos antes de dárselo al modelo.

    En la prueba del 17-nov el modelo recibió `118800` (Netflix al año) y
    escribió "$11.880": al ponerle el punto de miles se comió un dígito. Un
    modelo de lenguaje copia texto mucho mejor de lo que reescribe números, así
    que el formato lo pone este código y al modelo solo le queda copiar
    "$118.800". Es la misma idea de siempre: lo que puede salir mal, que no
    dependa del modelo.
    """
    if isinstance(dato, dict):
        return {k: montos_escritos(v, k) for k, v in dato.items()}
    if isinstance(dato, list):
        return [montos_escritos(v, clave) for v in dato]
    if isinstance(dato, (int, float)) and not isinstance(dato, bool) and clave and _ES_MONTO.match(clave):
        return pesos(dato)
    return dato


def filtrar_argumentos(funcion, argumentos: dict) -> dict:
    """
    Deja solo los argumentos que la función conoce.

    El modelo a veces manda basura —se vio `{"": {}}` en la prueba— y una
    herramienta que se cae por eso deja a la persona sin respuesta.
    """
    validos = inspect.signature(funcion).parameters
    return {k: v for k, v in (argumentos or {}).items() if k in validos}


# ─────────────────────────── definiciones ───────────────────────────────────

_MES = {"type": "string", "description": "Mes en formato AAAA-MM, por ejemplo 2026-10."}

CATEGORIAS = ("Vivienda, Supermercado, Delivery, Vestuario, Servicios, Transporte, Gimnasio, "
              "Entretención, Salud, Educación, Suscripciones, Sueldo, Sin categorizar")


def _definir(nombre: str, descripcion: str, propiedades: dict | None = None,
             requeridos: list[str] | None = None) -> dict:
    """
    Definición de una herramienta en el formato del proveedor.

    Los parámetros opcionales aceptan además `null`. El proveedor valida cada
    llamada contra el esquema y, si el modelo manda `"categoria": null` donde
    dice "string", rechaza la llamada entera: así falló "¿cuánto gasto en
    promedio al mes?" en la prueba del 17-nov.
    """
    requeridos = requeridos or []
    propiedades = {
        k: v if k in requeridos else {**v, "type": [v["type"], "null"]}
        for k, v in (propiedades or {}).items()
    }
    return {"type": "function", "function": {
        "name": nombre,
        "description": descripcion,
        "parameters": {"type": "object", "properties": propiedades, "required": requeridos},
    }}


DEFINICIONES = [
    _definir(
        "gasto_por_categoria",
        f"Gasto de un mes por categoría, con porcentajes. Categorías: {CATEGORIAS}. "
        "Para un grupo ('comida' = Supermercado y Delivery) pásalas en 'categorias' y usa el subtotal.",
        {"mes": _MES,
         "categorias": {"type": "array", "items": {"type": "string"},
                        "description": "Opcional: categorías cuyo subtotal se quiere."}},
        ["mes"]),
    _definir(
        "detalle_categoria",
        "En qué comercios se fue el gasto de una categoría en un mes.",
        {"mes": _MES, "categoria": {"type": "string"}}, ["mes", "categoria"]),
    _definir(
        "gasto_en_comercio",
        "Cuánto se gastó y cuántas compras se hicieron en un comercio (Falabella, Uber, Rappi…), "
        "total y mes a mes. Pasa solo cuántos meses completos; incluir_mes_actual agrega el mes en curso.",
        {"comercio": {"type": "string", "description": "Nombre del comercio, como lo diría la persona."},
         "ultimos_meses": {"type": "integer", "minimum": 0, "maximum": 12,
                           "description": "Cuántos meses hacia atrás. Por omisión 3."},
         "incluir_mes_actual": {"type": "boolean",
                                "description": "Agregar el mes en curso a los meses completos. Por omisión no. "
                                               "Para 'este mes' solamente: ultimos_meses=0 e incluir_mes_actual=true."}},
        ["comercio"]),
    _definir(
        "me_alcanza",
        "Si alcanza para una compra de cierto monto, hoy y hasta el día de pago. Trae el veredicto "
        "y una respuesta_sugerida ya redactada: úsala tal cual.",
        {"monto": {"type": "number", "description": "Monto de la compra en pesos."}}, ["monto"]),
    _definir(
        "promedio_mensual",
        "Gasto promedio por mes, total o de una categoría, en los últimos meses completos.",
        {"categoria": {"type": "string", "description": "Opcional. Sin ella, el promedio de todo el gasto."}}),
    _definir(
        "gastos_hormiga",
        "Gastos hormiga: compras chicas y repetidas que suman. Trae el criterio, el total y los comercios.",
        {"ultimos_meses": {"type": "integer", "minimum": 1, "maximum": 6,
                           "description": "Cuántos meses completos mirar. Por omisión 3."}}),
    _definir(
        "simular_ahorro_extra",
        "En cuántos meses se cumple una meta si se ahorra un monto extra al mes (negativo si es "
        "menos). Simulación Monte Carlo con y sin el cambio.",
        {"meta": {"type": "string", "description": "La meta tal como la nombró la persona (ej. 'switch'). "
                                                   "Vacío solo si no dijo ninguna."},
         "ahorro_extra_mensual": {"type": "number", "description": "Pesos extra al mes. Negativo si es menos."}},
        ["meta", "ahorro_extra_mensual"]),
    _definir(
        "comparar_meses",
        "Compara el gasto de un mes con otro (por omisión, el anterior), con el cambio porcentual.",
        {"mes": _MES, "otro_mes": {**_MES, "description": "Mes de referencia. Opcional."}},
        ["mes"]),
    _definir(
        "flujo_de_caja",
        "Excedente del mes, libre hoy, cuánto se puede gastar por día hasta el pago y con cuánto "
        "se llega al día de pago."),
    _definir(
        "gastos_recurrentes",
        "Cobros que se repiten (arriendo, cuentas, gimnasio, Netflix…), al mes y al año. Para "
        "algunos, pásalos en 'nombres' y usa el subtotal.",
        {"nombres": {"type": "array", "items": {"type": "string"},
                     "description": "Opcional: cobros cuyo subtotal se quiere."}}),
    _definir(
        "metas",
        "Metas: ahorrado, cuánto falta y en cuántos meses se cumplen (80% y 95% de probabilidad)."),
    _definir(
        "creditos",
        "Créditos vigentes: cuota mensual, cuotas restantes, fecha de la última cuota y saldo."),
]

#: Cómo se le muestra a la persona qué consultó el asistente.
TITULOS = {
    "gasto_por_categoria": "Gasto por categoría",
    "detalle_categoria": "Detalle de una categoría",
    "gasto_en_comercio": "Gasto en un comercio",
    "me_alcanza": "¿Me alcanza?",
    "promedio_mensual": "Promedio mensual",
    "gastos_hormiga": "Gastos hormiga",
    "simular_ahorro_extra": "Simulación de ahorro",
    "comparar_meses": "Comparación entre meses",
    "flujo_de_caja": "Flujo de caja",
    "gastos_recurrentes": "Gastos recurrentes",
    "metas": "Metas de ahorro",
    "creditos": "Créditos",
}


# ─────────────────────────── ejecución ──────────────────────────────────────


_PALABRAS_VACIAS = {"la", "el", "los", "las", "mi", "mis", "un", "una", "de", "del", "para", "al", "meta"}


def elegir_por_nombre(buscado: str, filas: list[dict]) -> list[dict]:
    """
    Las filas cuyo nombre mejor calza con lo que dijo la persona, por palabras.

    "la switch" tiene que encontrar "Nintendo Switch 2", y "viaje" a "Viaje al
    sur". Gana la que comparte más palabras; si empatan, se devuelven todas y
    la herramienta pregunta cuál.
    """
    palabras = {p for p in gasto._normalizar(buscado).split() if p not in _PALABRAS_VACIAS}
    if not palabras:
        return []
    puntaje = [(len(palabras & set(gasto._normalizar(f["nombre"]).split())), f) for f in filas]
    mejor = max(p for p, _ in puntaje)
    return [f for p, f in puntaje if p == mejor and p > 0]


class Herramientas:
    """
    Las herramientas de UNA persona.

    El `usuario_id` sale del token de sesión, nunca del modelo: el modelo no
    puede pedir datos de otro usuario porque ninguna herramienta recibe un id.
    """

    def __init__(self, usuario_id: str, hoy: date | None = None):
        self.usuario_id = usuario_id
        self.hoy = hoy or date.today()
        self._movimientos: list[dict] | None = None

    # Los movimientos se leen una vez por pregunta, aunque se usen en varias
    # herramientas.
    def _movs(self) -> list[dict]:
        if self._movimientos is None:
            from api import db
            from api.datos import _SELECT_MOVIMIENTOS, _movimiento

            # Los mismos 500 más recientes que descarga la app: si el chat
            # mirara más historial que el dashboard, podrían no coincidir.
            with db.conectar(diccionarios=True) as conn:
                filas = conn.execute(
                    _SELECT_MOVIMIENTOS + """
                    WHERE c.usuario_id = %s
                    ORDER BY t.fecha DESC, t.created_at DESC
                    LIMIT 500""",
                    (self.usuario_id,),
                ).fetchall()
            self._movimientos = [_movimiento(f) for f in filas]
        return self._movimientos

    # ── las herramientas ──
    def gasto_por_categoria(self, mes: str, categorias: list[str] | None = None) -> dict:
        return gasto.gasto_por_categoria(self._movs(), mes, categorias)

    def detalle_categoria(self, mes: str, categoria: str) -> dict:
        return gasto.detalle_categoria(self._movs(), mes, categoria)

    def gasto_en_comercio(self, comercio: str, ultimos_meses: int = 3,
                          incluir_mes_actual: bool = False) -> dict:
        try:
            cuantos = min(12, max(0, int(ultimos_meses)))
        except (TypeError, ValueError):
            cuantos = 3
        meses = gasto.ultimos_meses(self.hoy, cuantos, bool(incluir_mes_actual))
        return gasto.gasto_en_comercio(self._movs(), comercio, meses)

    def comparar_meses(self, mes: str, otro_mes: str | None = None) -> dict:
        r = gasto.comparar_meses(self._movs(), mes, otro_mes)
        return r if r is not None else {"sin_dato": "No hay gasto registrado en el mes de referencia."}

    def flujo_de_caja(self) -> dict:
        from api.flujo import ver_flujo
        return resumir_flujo(ver_flujo(usuario_id=self.usuario_id))

    def me_alcanza(self, monto: float) -> dict:
        try:
            monto = float(monto)
        except (TypeError, ValueError):
            return {"error": "El monto tiene que ser un número."}
        return evaluar_compra(self.flujo_de_caja(), monto)

    def promedio_mensual(self, categoria: str | None = None) -> dict:
        return gasto.promedio_mensual(self._movs(), self.hoy, categoria or None)

    def gastos_hormiga(self, ultimos_meses: int = 3) -> dict:
        try:
            cuantos = min(6, max(1, int(ultimos_meses)))
        except (TypeError, ValueError):
            cuantos = 3
        return gasto.gastos_hormiga(self._movs(), gasto.ultimos_meses(self.hoy, cuantos))

    def simular_ahorro_extra(self, ahorro_extra_mensual: float, meta: str | None = None) -> dict:
        from api import db
        from api.metas import _historial

        try:
            extra = float(ahorro_extra_mensual)
        except (TypeError, ValueError):
            return {"error": "El ahorro extra tiene que ser un número."}
        with db.conectar(diccionarios=True) as conn:
            excedentes = _historial(conn, self.usuario_id)
            filas = conn.execute(
                "SELECT nombre, monto_objetivo, monto_ahorrado FROM meta "
                "WHERE usuario_id = %s ORDER BY creada_en", (self.usuario_id,)).fetchall()
        if not filas:
            return {"sin_dato": "La persona no tiene metas creadas."}
        if meta:
            elegidas = elegir_por_nombre(meta, filas)
        else:
            elegidas = filas if len(filas) == 1 else []
        if len(elegidas) != 1:
            return {"falta_elegir": "¿Para qué meta?", "metas": [f["nombre"] for f in filas]}
        f = elegidas[0]
        return {"meta": f["nombre"],
                **simular_ahorro_extra(excedentes, float(f["monto_ahorrado"]),
                                       float(f["monto_objetivo"]), extra)}

    def gastos_recurrentes(self, nombres: list[str] | None = None) -> dict:
        from api.suscripciones import listar
        return resumir_recurrentes(listar(usuario_id=self.usuario_id),
                                   nombres if isinstance(nombres, list) else None)

    def metas(self) -> dict:
        from api.metas import listar
        return resumir_metas(listar(usuario_id=self.usuario_id))

    def creditos(self) -> dict:
        from api.creditos import listar
        return resumir_creditos(listar(usuario_id=self.usuario_id), self.hoy)

    def ejecutar(self, nombre: str, argumentos: dict) -> dict:
        """Corre una herramienta por nombre. Nunca lanza: el error vuelve al modelo como dato."""
        if nombre not in TITULOS:
            return {"error": f"No existe la herramienta {nombre}."}
        funcion = getattr(self, nombre)
        # Un null del modelo en un campo opcional equivale a no mandarlo.
        argumentos = {k: v for k, v in (argumentos or {}).items() if v is not None}
        try:
            return montos_escritos(funcion(**filtrar_argumentos(funcion, argumentos)))
        except TypeError as e:  # faltó un argumento obligatorio
            return {"error": f"Argumentos inválidos: {e}"}
