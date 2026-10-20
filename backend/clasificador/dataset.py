# -*- coding: utf-8 -*-
"""
Dataset de entrenamiento y evaluación.

Dos fuentes:

1. Los movimientos del simulador/base: cada comercio da la etiqueta "gold" vía
   taxonomia.GOLD_COMERCIO. Sirven como prueba "limpia".

2. Aumento de datos: por cada comercio generamos glosas con el RUIDO de una
   cartola real (prefijos de medio de pago, número de local, ciudad, dominios,
   abreviaturas y erratas).

Lo importante de la evaluación: separamos las formas del NOMBRE del comercio en
`vistas` (para entrenar) y `ocultas` (solo para test). Así el modelo se mide
contra variantes que NUNCA vio tal cual — que es el escenario real: cada cartola
escribe el comercio distinto. Varias formas ocultas rompen a propósito las
reglas por substring, para ver si el modelo las recupera.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

from .taxonomia import GOLD_COMERCIO

_PREFIJOS = ["", "", "COMPRA ", "PAGO ", "COMPRA WEB ", "WEB ", "PAC ", "TEF ",
             "TRANSBANK *", "MERPAGO*", "MPAGO*", "PAGO PAT "]
_CIUDADES = ["", "", "", "SANTIAGO", "LAS CONDES", "PROVIDENCIA", "MAIPU",
             "VINA DEL MAR", "CONCEPCION", "STGO"]
_SUFIJOS_WEB = ["", "", ".CL", ".COM", " CL"]

# Por comercio: formas "vistas" (entrenamiento) y "ocultas" (solo test). Las
# ocultas incluyen abreviaturas y erratas; algunas (SMART-FIT, UBER* EATS,
# NETFLX, LIDR...) no contienen el substring exacto de la regla.
_VARIANTES = {
    # Supermercado
    "Lider":        (["Lider", "LIDER", "Lider Express", "LIDER.CL", "SMU LIDER"], ["LIDR", "LIDER EXP"]),
    "Jumbo":        (["Jumbo", "JUMBO", "JUMBO.CL", "CENCOSUD JUMBO"], ["JMBO", "JUMBO ONLINE"]),
    "Unimarc":      (["Unimarc", "UNIMARC", "Unimarc Express"], ["UNIMRC", "UNMARC"]),
    "Santa Isabel": (["Santa Isabel", "SANTA ISABEL", "STA ISABEL"], ["STA. ISABEL", "SANTA ISAB"]),
    "Tottus":       (["Tottus", "TOTTUS", "HIPER TOTTUS"], ["TOTUS", "TOTTUS ONLINE"]),
    # Delivery
    "Uber Eats":    (["Uber Eats", "UBER EATS", "UBEREATS"], ["UBER* EATS", "UBER *EATS"]),
    "Rappi":        (["Rappi", "RAPPI", "RAPPI CHILE", "RAPPI*PEDIDO"], ["RAPI", "RAPPI SPA"]),
    "PedidosYa":    (["PedidosYa", "PEDIDOSYA", "PEDIDOS YA"], ["PEDIDOSYA*", "PEDIDOS-YA"]),
    # Restaurantes
    "Starbucks":    (["Starbucks", "STARBUCKS", "STARBUCKS COFFEE"], ["STARBCKS", "SBUX"]),
    # Transporte
    "Copec":        (["Copec", "COPEC", "COPEC APP", "COMB COPEC"], ["CPEC", "COPEC-PRONTO"]),
    "Shell":        (["Shell", "SHELL", "SHELL ENEX", "ESTACION SHELL"], ["SHEL", "ENEX SHELL"]),
    "Uber":         (["Uber", "UBER", "UBER TRIP", "UBER *TRIP"], ["UBER BV", "UBER VIAJE"]),
    "Metro de Santiago": (["Metro de Santiago", "METRO SANTIAGO", "CARGA BIP METRO", "METRO S.A."], ["BIP METRO", "METRO DE STGO"]),
    # Servicios
    "CGE":          (["CGE", "CGE DISTRIBUCION", "PAGO CGE"], ["C.G.E.", "CGE DIST"]),
    "Enel":         (["Enel", "ENEL", "ENEL DISTRIBUCION", "PAGO ENEL"], ["ENEL CHILE", "ENL DISTRIB"]),
    "Essal":        (["Essal", "ESSAL", "AGUAS ESSAL"], ["ESSAL S.A.", "ESSAL AGUAS"]),
    "Aguas Andinas": (["Aguas Andinas", "AGUAS ANDINAS", "AGUAS ANDINAS SA"], ["AG. ANDINAS", "AGUAS ANDIN"]),
    "Abastible":    (["Abastible", "ABASTIBLE", "GAS ABASTIBLE"], ["ABASTBLE", "ABAST GAS"]),
    "Metrogas":     (["Metrogas", "METROGAS", "METROGAS SA"], ["METRO GAS", "MTROGAS"]),
    "Entel":        (["Entel", "ENTEL", "ENTEL PCS", "ENTEL HOGAR"], ["ENTL", "ENTEL MOVIL"]),
    "VTR":          (["VTR", "VTR BANDA ANCHA", "VTR.COM"], ["V.T.R.", "VTR HOGAR"]),
    # Entretención
    "Netflix":      (["Netflix", "NETFLIX", "NETFLIX.COM"], ["NETFLX", "NFLIX"]),
    "Spotify":      (["Spotify", "SPOTIFY", "SPOTIFY AB"], ["SPOTIFY*", "SPOTFY"]),
    "Spotify Familiar": (["Spotify Familiar", "SPOTIFY FAMILY", "SPOTIFY PREMIUM FAM"], ["SPOTIFY FAM", "SPTFY FAMILIAR"]),
    "Disney+":      (["Disney+", "DISNEY PLUS", "DISNEYPLUS"], ["DISNEY+ CL", "DSNY PLUS"]),
    "YouTube Premium": (["YouTube Premium", "YOUTUBE PREMIUM", "GOOGLE*YOUTUBE PREM"], ["YOUTUBE PREM", "YT PREMIUM"]),
    # Suscripciones
    "iCloud":       (["iCloud", "ICLOUD", "APPLE ICLOUD"], ["ICLOUD+", "APPLE.COM/BILL"]),
    # Salud
    "Farmacia Ahumada": (["Farmacia Ahumada", "FARMACIA AHUMADA", "FARM AHUMADA"], ["FCIA AHUMADA", "FASA AHUMADA"]),
    "Cruz Verde":   (["Cruz Verde", "CRUZ VERDE", "FARMACIAS CRUZ VERDE"], ["CRUZVERDE", "FCIA CRUZ VERDE"]),
    # Gimnasio
    "Smart Fit":    (["Smart Fit", "SMART FIT", "SMARTFIT"], ["SMART-FIT", "SMRT FIT"]),
    # Vivienda
    "Inmobiliaria Los Robles": (["Inmobiliaria Los Robles", "INMOB LOS ROBLES", "ARRIENDO LOS ROBLES"], ["INMOB. LOS ROBLES", "LOS ROBLES ARR"]),
    "Arriendos Estudiantiles SpA": (["Arriendos Estudiantiles SpA", "ARRIENDOS ESTUDIANTILES", "ARRIENDO PIEZA"], ["ARR ESTUDIANTIL", "ARRIENDOS ESTUD SPA"]),
    "Dividendo Hipotecario": (["Dividendo Hipotecario", "DIVIDENDO HIPOTECARIO", "PAGO DIVIDENDO"], ["DIV HIPOTECARIO", "DIVIDENDO HIP"]),
    # Vestuario
    "Falabella":    (["Falabella", "FALABELLA", "FALAB RETAIL"], ["FALABELA", "FALAB"]),
    "Paris":        (["Paris", "PARIS", "PARIS.CL", "TIENDA PARIS"], ["PARIS CENCOSUD", "PRS TIENDA"]),
    "Ripley":       (["Ripley", "RIPLEY", "RIPLEY.COM", "TIENDA RIPLEY"], ["RIPLY", "RIPLEY STORE"]),
    # Educación
    "Colegio San Ignacio": (["Colegio San Ignacio", "COLEGIO SAN IGNACIO", "MENSUALIDAD COLEGIO"], ["COL SAN IGNACIO", "COLEGIO S IGNACIO"]),
    # Hogar
    "Homecenter Sodimac": (["Homecenter Sodimac", "SODIMAC", "HOMECENTER", "SODIMAC HOMECENTER"], ["SODIMAC HC", "HOMECTR SODIMAC"]),
}

# Glosas SIN comercio, como las que manda un banco cuando el pago pasó por un
# intermediario (Transbank, Mercado Pago, un PAC). No dicen en qué se gastó: lo
# correcto es abstenerse. Se usan solo para medir eso, nunca para entrenar.
GLOSAS_SIN_COMERCIO = [
    "TRANSBANK*CL 8829", "TRANSBANK*CL 7781", "TRANSBANK*CL 4410", "PAGO PSP 4471 STGO",
    "PAGO PSP 9921 STGO", "CL*SERV 2210", "MPAGO*KIOSKO 551", "PAC SEGURO 0042",
    "COMPRA NACIONAL 0012", "TEF 99812 SANTIAGO", "CARGO VARIOS 3381", "PAT 7712 CL",
]

# Comercios que el modelo NUNCA vio (no están en GOLD_COMERCIO). Miden qué pasa
# con un comercio nuevo: lo esperado es que acierte o se abstenga, no que
# invente con seguridad.
COMERCIOS_NUEVOS = [
    ("Acuenta", "Supermercado"), ("Salcobrand", "Salud"), ("Cabify", "Transporte"),
    ("Movistar", "Servicios"), ("HBO Max", "Entretención"), ("Sportlife", "Gimnasio"),
    ("Petrobras", "Transporte"), ("Easy", "Hogar"), ("Zara", "Vestuario"),
    ("Juan Valdez Cafe", "Restaurantes"), ("Universidad de Chile", "Educación"),
    ("Lipigas", "Servicios"),
]


def _glosa(base: str, rnd: random.Random) -> str:
    partes = [rnd.choice(_PREFIJOS), base]
    if rnd.random() < 0.5:
        partes.append(rnd.choice(_SUFIJOS_WEB))
    if rnd.random() < 0.5:
        partes.append(str(rnd.randrange(100, 9999)))
    if rnd.random() < 0.4:
        partes.append(rnd.choice(_CIUDADES))
    return " ".join(p for p in partes if p).strip()


def generar_dataset(split: str = "train", por_comercio: int = 120, semilla: int = 42):
    """
    split="train" usa las formas VISTAS del nombre; split="test" usa las OCULTAS
    (nunca vistas en entrenamiento). Devuelve [(glosa, categoria)].
    """
    rnd = random.Random(semilla if split == "train" else semilla + 1)
    idx = 0 if split == "train" else 1
    pares = []
    for comercio, categoria in GOLD_COMERCIO.items():
        formas = _VARIANTES[comercio][idx]
        n = por_comercio if split == "train" else max(30, por_comercio // 3)
        for _ in range(n):
            pares.append((_glosa(rnd.choice(formas), rnd), categoria))
    rnd.shuffle(pares)
    return pares


def glosas_con_ruido(pares, n: int = 5, semilla: int = 7):
    """Cada (base, categoria) en n glosas ruidosas, como llegarían en una cartola."""
    rnd = random.Random(semilla)
    return [(_glosa(base, rnd), cat) for base, cat in pares for _ in range(n)]


def cargar_simulador(ruta: str | Path):
    """[(glosa, categoria_gold)] de los cargos del simulador cuyo comercio conocemos."""
    datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    pares = []
    for t in datos:
        if (t.get("transactionsType") or "").lower() != "cargo":
            continue
        md = t.get("merchantDetails") or {}
        nombre = md.get("name")
        glosa = nombre or t.get("paymentPurposeCode") or ""
        cat = GOLD_COMERCIO.get(nombre)
        if glosa and cat:
            pares.append((glosa, cat))
    return pares
