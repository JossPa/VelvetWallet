# -*- coding: utf-8 -*-
"""
El ciclo de una pregunta: el modelo elige herramientas, se ejecutan y redacta.

  persona ──pregunta──▶ modelo ──"llama a flujo_de_caja"──▶ herramienta
                          ▲                                     │
                          └──────────── resultado ◀─────────────┘
                          │
                          └──respuesta en palabras──▶ persona

**El modelo nunca calcula.** Las instrucciones se lo prohíben, pero eso no
basta como garantía: lo que sí la da es que no tiene los datos. No ve los
movimientos; solo ve lo que devuelve la herramienta que pidió, y eso ya viene
calculado. Si no hay herramienta para algo, no tiene de dónde sacar la cifra.

**No se guarda la conversación.** El historial lo lleva la app y lo manda en
cada pregunta; el servidor no lo almacena. Una conversación sobre plata es un
dato personal más, y lo más simple para protegerlo es no tenerlo.

El cliente del modelo se recibe por parámetro: en producción es Groq, en las
pruebas es un doble que responde lo que la prueba necesita. Así el ciclo se
prueba sin red y sin gastar cuota.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date

from .herramientas import DEFINICIONES, TITULOS

#: Nombre del personaje que responde en la app.
MASCOTA = "Velvi"

#: Vueltas máximas modelo → herramienta → modelo. Una pregunta normal usa una
#: o dos; si no termina en cinco, algo anda mal y es mejor decirlo que girar.
VUELTAS_MAXIMAS = 5

#: Cuánto historial se le pasa al modelo. Lo reciente basta para entender
#: "¿y en septiembre?"; más contexto solo encarece y distrae.
MENSAJES_DE_CONTEXTO = 10

#: Tope de la respuesta del modelo. Las respuestas son de 1 a 3 frases; un tope
#: holgado no las mejora y sí consume la cuota del plan gratuito, que es de
#: 8.000 tokens por minuto y cada pregunta hace dos llamadas.
TOKENS_DE_SALIDA = 500

#: Cuánto razona el modelo antes de responder. Se probó "low" para gastar
#: menos cuota y el modelo empezó a escribir mal el nombre de las herramientas
#: ("fluxo_de_caja", "metas" con letras cirílicas), que el proveedor rechaza.
#: En "medium" fueron 9 llamadas válidas de 9 por ~1.500 tokens cada una.
RAZONAMIENTO = "medium"

#: Reintentos por pregunta ante una llamada mal formada o una respuesta vacía.
#: El modelo no es determinista: el mismo pedido, repetido, casi siempre sale bien.
REINTENTOS = 2

SIN_RESPUESTA = "No alcancé a armar una respuesta. ¿Me la preguntas de otra forma?"

_MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
          "septiembre", "octubre", "noviembre", "diciembre")


def instrucciones(hoy: date) -> str:
    return f"""Eres {MASCOTA}, la asistente de Velvet Wallet, una app chilena de finanzas personales.
Hoy es {hoy.day} de {_MESES[hoy.month - 1]} de {hoy.year} ({hoy.isoformat()}).

Reglas:
1. Toda cifra que digas debe salir textual de una herramienta. Nunca sumes, restes, promedies,
   estimes ni redondees tú. Si ninguna herramienta entrega el número, di que no tienes ese dato.
2. Los montos vienen ya escritos por la herramienta ("$118.800"): cópialos exactamente así,
   carácter por carácter. Nunca reescribas, acortes ni combines montos.
3. Si la herramienta trae "respuesta_sugerida", úsala tal cual: ya tiene las cifras en el orden
   correcto. Puedes agregar una frase breve, sin cifras nuevas.
4. Describes y proyectas los datos de la persona. No das asesoría de inversión ni recomiendas
   productos financieros; si te lo piden, dilo en una frase y ofrece algo que sí puedas responder.
5. Solo conoces los datos de quien te escribe. No tienes datos de otras personas.
6. Responde en español de Chile, cercano y breve: 1 a 3 frases. Texto plano, sin negritas,
   listas, tablas ni emojis. Si hay muchas categorías, nombra las 3 más grandes y el total.
7. Para metas, da el plazo con 80% de probabilidad y, si aporta, el de 95%.
8. A los cobros recurrentes no los llames a todos "suscripciones": distingue arriendo y cuentas
   básicas de servicios como Netflix o Spotify.
9. "El mes pasado" es el mes calendario anterior a hoy. Si la pregunta no dice el mes, usa el
   último mes completo. Cuando una respuesta cubra varios meses, nombra cuáles fueron.
10. Si una herramienta devuelve cero porque no hay compras (por ejemplo, un comercio sin
   movimientos), dilo así: "no registras compras en ese comercio". Eso no es lo mismo que no
   tener el dato."""


@dataclass
class Respuesta:
    texto: str
    #: Herramientas que se usaron, con su título legible, en orden y sin repetir.
    consultas: list[str] = field(default_factory=list)


class AsistenteNoDisponible(Exception):
    """El proveedor del modelo no respondió (cuota, red, caída)."""

    @property
    def sin_cuota(self) -> bool:
        texto = str(self).lower()
        return "rate_limit" in texto or "429" in texto


def limpiar(texto: str) -> str:
    """
    Quita el formato Markdown que el modelo a veces pone pese a la instrucción.

    La burbuja del chat muestra texto plano: un "**$272.055**" se vería con
    los asteriscos.
    """
    texto = re.sub(r"\*\*(.+?)\*\*", r"\1", texto)
    texto = re.sub(r"__(.+?)__", r"\1", texto)
    texto = re.sub(r"^\s*[-*•]\s+", "", texto, flags=re.MULTILINE)
    texto = re.sub(r"^#+\s*", "", texto, flags=re.MULTILINE)
    # Los montos llegan como texto ("$524.279") y el modelo a veces los copia
    # con las comillas del JSON.
    texto = re.sub(r"[\"\u201c\u201d']\s*(-?\$[\d.]+)\s*[\"\u201c\u201d']", r"\1", texto)
    texto = texto.strip()
    return texto[:1].upper() + texto[1:]


def _a_mensajes(historial: list[dict]) -> list[dict]:
    """Historial de la app ({rol, texto}) al formato del proveedor."""
    rol = {"usuario": "user", "asistente": "assistant"}
    return [{"role": rol[m["rol"]], "content": m["texto"]}
            for m in historial[-MENSAJES_DE_CONTEXTO:]]


def responder(cliente, modelo: str, herramientas, historial: list[dict],
              hoy: date | None = None) -> Respuesta:
    """
    Responde la última pregunta del historial.

    `cliente` tiene la forma del SDK de Groq (`cliente.chat.completions.create`).
    `herramientas` expone `ejecutar(nombre, argumentos) -> dict`.
    """
    hoy = hoy or date.today()
    mensajes = [{"role": "system", "content": instrucciones(hoy)}] + _a_mensajes(historial)
    consultas: list[str] = []
    reintentos = REINTENTOS
    vueltas = 0

    # Los reintentos no gastan vueltas: el tope de vueltas mide cuántas veces
    # el modelo pidió herramientas, no cuántas veces hubo que repetirle algo.
    while vueltas < VUELTAS_MAXIMAS:
        try:
            r = cliente.chat.completions.create(
                model=modelo, messages=mensajes, tools=DEFINICIONES, tool_choice="auto",
                temperature=0.2, max_tokens=TOKENS_DE_SALIDA, reasoning_effort=RAZONAMIENTO,
            )
        except Exception as e:  # noqa: BLE001 — cuota, red o caída del proveedor
            # El proveedor rechaza la llamada si el modelo inventa el nombre de
            # una herramienta ("tool_use_failed"). Es un error del modelo, no
            # del servicio: se vuelve a pedir.
            if "tool_use_failed" in str(e) and reintentos > 0:
                reintentos -= 1
                continue
            raise AsistenteNoDisponible(str(e)) from e

        msg = r.choices[0].message
        if not msg.tool_calls:
            texto = limpiar(msg.content or "")
            # Una respuesta vacía se vuelve a pedir; si insiste, no se muestra
            # una burbuja en blanco.
            if not texto and reintentos > 0:
                reintentos -= 1
                continue
            return Respuesta(texto=texto or SIN_RESPUESTA, consultas=consultas)

        vueltas += 1
        mensajes.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [{"id": t.id, "type": "function",
                            "function": {"name": t.function.name, "arguments": t.function.arguments}}
                           for t in msg.tool_calls],
        })
        for llamada in msg.tool_calls:
            try:
                argumentos = json.loads(llamada.function.arguments or "{}")
            except json.JSONDecodeError:
                argumentos = {}
            if not isinstance(argumentos, dict):
                argumentos = {}
            resultado = herramientas.ejecutar(llamada.function.name, argumentos)
            titulo = TITULOS.get(llamada.function.name)
            if titulo and titulo not in consultas:
                consultas.append(titulo)
            mensajes.append({"role": "tool", "tool_call_id": llamada.id,
                             "content": json.dumps(resultado, ensure_ascii=False)})

    return Respuesta(texto=SIN_RESPUESTA, consultas=consultas)


def responder_con_respaldo(cliente, modelos: list[str], herramientas, historial: list[dict],
                           hoy: date | None = None) -> Respuesta:
    """
    Igual que `responder`, pero si un modelo se quedó sin cuota prueba el siguiente.

    El plan gratuito de Groq limita los tokens **por modelo**: 8.000 por minuto
    y 200.000 por día. Una pregunta gasta unos 3.000, así que el modelo
    principal alcanza para unas 60 preguntas diarias. Cuando se agota, el de
    respaldo tiene su propia cuota. Cualquier otro error no se reintenta con
    otro modelo: no es un problema de cuota y probablemente fallaría igual.
    """
    ultimo: AsistenteNoDisponible | None = None
    for modelo in modelos:
        try:
            return responder(cliente, modelo, herramientas, historial, hoy)
        except AsistenteNoDisponible as e:
            if not e.sin_cuota:
                raise
            ultimo = e
    raise ultimo or AsistenteNoDisponible("No hay modelos configurados.")
