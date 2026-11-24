# -*- coding: utf-8 -*-
"""
Gasto del mes por categoría — "¿en qué se me va la plata?".

Es el mismo cálculo que hace la app en `movil/src/utils/resumen.ts` y
`desglose.ts`, escrito en Python para que el asistente conversacional pueda
responder con él. Las reglas tienen que ser idénticas a las de la app, porque
si el chat y el dashboard dicen cifras distintas sobre el mismo mes, la persona
deja de creerle a los dos:

  · Gasto = cargos (monto negativo), sin los movimientos excluidos.
  · El mes sale de la fecha del movimiento.
  · Lo que no tiene categoría se cuenta como "Sin categorizar"; no se reparte
    entre las demás ni se descarta.

Para que no se separen, las dos implementaciones se prueban contra el mismo
caso: `movil/src/utils/__tests__/datos/gasto-compartido.json`. Si una cambia y
la otra no, falla la prueba de la que quedó atrás.

Funciones puras: reciben la lista de movimientos (con la forma que entrega
GET /api/movimientos) y no tocan la base de datos.
"""
from __future__ import annotations

import math
from collections import defaultdict

SIN_CATEGORIA = "Sin categorizar"


def redondear(x: float) -> int:
    """
    Redondeo de JavaScript (`Math.round`): los .5 suben siempre.

    `round()` de Python redondea al par más cercano (12,5 -> 12), y la app usa
    `Math.round` (12,5 -> 13). Con dos reglas distintas, el mismo porcentaje se
    vería distinto en el chat y en el dashboard.
    """
    return math.floor(x + 0.5)


def clave_mes(fecha_iso: str) -> str:
    """"2026-10-05T12:00:00-03:00" -> "2026-10"."""
    return fecha_iso[:7]


def mes_anterior(mes: str) -> str:
    """"2026-01" -> "2025-12"."""
    anio, numero = int(mes[:4]), int(mes[5:7])
    return f"{anio - 1}-12" if numero == 1 else f"{anio}-{numero - 1:02d}"


def _categoria(m: dict) -> str:
    return m.get("categoria") or SIN_CATEGORIA


def cargos(movimientos: list[dict], mes: str) -> list[dict]:
    """Cargos del mes, sin los excluidos. Los abonos no son gasto."""
    return [m for m in movimientos
            if m["monto"] < 0 and not m.get("excluido") and m.get("fecha")
            and clave_mes(m["fecha"]) == mes]


def totales_por_categoria(movimientos: list[dict], mes: str) -> dict[str, float]:
    totales: dict[str, float] = defaultdict(float)
    for m in cargos(movimientos, mes):
        totales[_categoria(m)] += abs(m["monto"])
    return dict(totales)


def gasto_por_categoria(movimientos: list[dict], mes: str,
                        categorias: list[str] | None = None) -> dict:
    """
    Gasto total del mes y su reparto por categoría, de mayor a menor.

    `categorias` sirve para preguntas que agrupan varias ("¿cuánto gasté en
    comida?" = Supermercado + Delivery): la suma la hace este código y no el
    modelo de lenguaje, que suma mal.
    """
    totales = totales_por_categoria(movimientos, mes)
    total = sum(totales.values())
    salida = {
        "mes": mes,
        "gasto_total": redondear(total),
        "cantidad_de_cargos": len(cargos(movimientos, mes)),
        "por_categoria": [
            {"categoria": c, "monto": redondear(v), "porcentaje": redondear(100 * v / total) if total else 0}
            for c, v in sorted(totales.items(), key=lambda kv: -kv[1])
        ],
    }
    if categorias:
        pedidas = {c.strip().lower() for c in categorias}
        encontradas = [c for c in totales if c.lower() in pedidas]
        salida["categorias_pedidas"] = {
            "encontradas": encontradas,
            "no_encontradas": sorted(pedidas - {c.lower() for c in encontradas}),
            "subtotal": redondear(sum(totales[c] for c in encontradas)),
        }
    return salida


def detalle_categoria(movimientos: list[dict], mes: str, categoria: str, maximo: int = 6) -> dict:
    """En qué comercios se fue el gasto de una categoría, de mayor a menor."""
    grupos: dict[str, list] = defaultdict(lambda: [0.0, 0])
    for m in cargos(movimientos, mes):
        if _categoria(m).lower() == categoria.strip().lower():
            g = grupos[m.get("comercio") or "Sin identificar"]
            g[0] += abs(m["monto"])
            g[1] += 1
    filas = sorted(grupos.items(), key=lambda kv: -kv[1][0])
    return {
        "mes": mes,
        "categoria": categoria,
        "total": redondear(sum(v[0] for _, v in filas)),
        "por_comercio": [{"comercio": c, "monto": redondear(v[0]), "compras": v[1]}
                         for c, v in filas[:maximo]],
    }


def _normalizar(texto: str) -> str:
    """Minúsculas y sin tildes: "Farmacias Ahumada" encuentra "farmacias ahumada"."""
    import unicodedata
    sin_tildes = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in sin_tildes if not unicodedata.combining(c)).lower().strip()


def ultimos_meses(hoy, cuantos: int, incluir_mes_actual: bool = False) -> list[str]:
    """
    Los últimos `cuantos` meses, del más antiguo al más reciente.

    Son meses completos: el mes en curso va a medias y contarlo como uno más
    haría parecer que se gastó menos. `incluir_mes_actual` lo **agrega** al
    final ("los últimos 3 meses y lo que va de noviembre" = agosto a
    noviembre), no reemplaza al más antiguo. Lo calcula el código y no el
    modelo de lenguaje, que se equivoca con facilidad contando meses.
    """
    actual = f"{hoy.year:04d}-{hoy.month:02d}"
    # Cero meses completos solo tiene sentido junto al mes en curso: "¿cuánto
    # llevo este mes en Uber?". Sin él, se toma al menos el último completo.
    cuantos = max(0 if incluir_mes_actual else 1, cuantos)
    meses: list[str] = []
    for _ in range(cuantos):
        meses.append(mes_anterior(meses[-1] if meses else actual))
    meses.reverse()
    if incluir_mes_actual:
        meses.append(actual)
    return meses


def gasto_en_comercio(movimientos: list[dict], comercio: str, meses: list[str]) -> dict:
    """
    Cuánto se gastó en un comercio durante varios meses, total y mes a mes.

    Busca el nombre dentro del comercio normalizado ("falabella" encuentra
    "Falabella" y "Falabella.com") y devuelve qué nombres calzaron, para que la
    respuesta pueda decir exactamente qué se sumó.
    """
    buscado = _normalizar(comercio)
    por_mes = {m: [0.0, 0] for m in meses}
    encontrados: set[str] = set()
    for mes in meses:
        for m in cargos(movimientos, mes):
            nombre = m.get("comercio") or ""
            if buscado and buscado in _normalizar(nombre):
                por_mes[mes][0] += abs(m["monto"])
                por_mes[mes][1] += 1
                encontrados.add(nombre)
    total = sum(v[0] for v in por_mes.values())
    return {
        "comercio_buscado": comercio,
        "comercios_que_calzaron": sorted(encontrados),
        "meses": meses,
        "total": redondear(total),
        "compras": sum(v[1] for v in por_mes.values()),
        "por_mes": [{"mes": m, "monto": redondear(v[0]), "compras": v[1]} for m, v in por_mes.items()],
    }


def promedio_mensual(movimientos: list[dict], hoy, categoria: str | None = None,
                     cuantos: int = 6) -> dict:
    """
    Gasto promedio por mes, total o de una categoría.

    Misma regla que la línea de promedio del dashboard (`gastoUltimosMeses` +
    `promedioMensual` en la app): se miran los últimos `cuantos` meses contando
    el actual, se deja fuera el mes en curso porque va a medias, y también los
    meses sin ningún gasto, que son meses antes de tener historial. Para una
    categoría, un mes con gasto pero sin esa categoría cuenta como cero: no
    pedir delivery un mes también es parte del promedio.
    """
    actual = f"{hoy.year:04d}-{hoy.month:02d}"
    meses = [actual]
    for _ in range(cuantos - 1):
        meses.append(mes_anterior(meses[-1]))
    completos = [m for m in reversed(meses[1:]) if cargos(movimientos, m)]

    def del_mes(mes: str) -> float:
        totales = totales_por_categoria(movimientos, mes)
        if categoria is None:
            return sum(totales.values())
        return sum(v for c, v in totales.items() if c.lower() == categoria.strip().lower())

    por_mes = [(m, del_mes(m)) for m in completos]
    promedio = sum(v for _, v in por_mes) / len(por_mes) if por_mes else 0.0
    return {
        "categoria": categoria or "Todo el gasto",
        "promedio_mensual": redondear(promedio),
        "meses_considerados": completos,
        "por_mes": [{"mes": m, "monto": redondear(v)} for m, v in por_mes],
        "nota": "No incluye el mes en curso porque va a medias.",
    }


#: Hasta qué monto un cargo cuenta como "hormiga".
UMBRAL_HORMIGA = 10_000
#: Cuántas compras en el período hacen falta para que sea hábito y no un gusto.
VECES_HORMIGA = 3


def gastos_hormiga(movimientos: list[dict], meses: list[str],
                   umbral: int = UMBRAL_HORMIGA, veces: int = VECES_HORMIGA) -> dict:
    """
    Gastos hormiga: compras chicas y repetidas que, sumadas, pesan.

    Criterio explícito —y devuelto en la respuesta, para que se pueda decir—:
    cargos de hasta `umbral` pesos, en un mismo comercio, al menos `veces` en
    el período. Se dejan fuera los cobros recurrentes (Spotify, Netflix): son
    un gasto fijo que la persona ya conoce, no un hábito que se le escapa.
    """
    grupos: dict[str, list] = defaultdict(lambda: [0.0, 0])
    for mes in meses:
        for m in cargos(movimientos, mes):
            if abs(m["monto"]) <= umbral and not m.get("esRecurrente"):
                g = grupos[m.get("comercio") or "Sin identificar"]
                g[0] += abs(m["monto"])
                g[1] += 1
    habitos = sorted(((c, v) for c, v in grupos.items() if v[1] >= veces), key=lambda kv: -kv[1][0])
    total = sum(v[0] for _, v in habitos)
    return {
        "criterio": (f"Compras de hasta ${umbral:,} en un mismo comercio, al menos {veces} veces "
                     "en el período, sin contar cobros recurrentes.").replace(",", "."),
        "meses": meses,
        "total_del_periodo": redondear(total),
        "promedio_por_mes": redondear(total / len(meses)) if meses else 0,
        "compras": sum(v[1] for _, v in habitos),
        "por_comercio": [{"comercio": c, "monto": redondear(v[0]), "compras": v[1]}
                         for c, v in habitos[:6]],
    }


def comparar_meses(movimientos: list[dict], mes: str, otro_mes: str | None = None,
                   cuantas: int = 5) -> dict | None:
    """
    Gasto de un mes contra otro (por omisión, el anterior), total y por categoría.

    Igual que en la app: el cambio porcentual se calcula solo donde hubo gasto
    en el mes de referencia, y si ese mes no tiene gasto no hay comparación.
    """
    otro = otro_mes or mes_anterior(mes)
    actuales = totales_por_categoria(movimientos, mes)
    anteriores = totales_por_categoria(movimientos, otro)
    if not anteriores:
        return None

    def cambio(actual: float, anterior: float) -> int | None:
        return None if anterior == 0 else redondear((actual - anterior) / anterior * 100)

    variaciones = [
        {"categoria": c, "mes": redondear(actuales.get(c, 0)), "mes_referencia": redondear(anteriores.get(c, 0)),
         "cambio_pct": cambio(actuales.get(c, 0), anteriores.get(c, 0))}
        for c in set(actuales) | set(anteriores)
    ]
    variaciones = [v for v in variaciones if v["cambio_pct"] is not None and v["mes_referencia"] > 0]
    variaciones.sort(key=lambda v: -abs(v["cambio_pct"]))

    total_actual, total_anterior = sum(actuales.values()), sum(anteriores.values())
    return {
        "mes": mes,
        "mes_referencia": otro,
        "total": {"mes": redondear(total_actual), "mes_referencia": redondear(total_anterior),
                  "cambio_pct": cambio(total_actual, total_anterior)},
        "por_categoria": variaciones[:cuantas],
    }
