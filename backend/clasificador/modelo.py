# -*- coding: utf-8 -*-
"""
El modelo del clasificador: SEGUNDA capa de la cascada (tarea E3).

Toma el texto de la glosa y predice una categoría de Velvet, con una medida de
confianza. Decisiones de diseño:

- Features: TF-IDF sobre n-gramas de CARACTERES (3 a 5). A diferencia de las
  palabras, los n-gramas de caracteres reconocen "NETFLIX", "NFLX" y
  "NETFLIX.COM" como parecidos, y aguantan abreviaturas y erratas de las
  cartolas reales. No necesita diccionario ni lematización en español.

- Modelo: Regresión Logística multinomial. Es lineal (rápida, explicable),
  entrega probabilidades calibrables y rinde muy bien sobre texto corto. Para un
  problema de 10 clases y miles de ejemplos no hace falta nada más pesado; una
  red neuronal sería injustificable (más costo, menos interpretabilidad, mismo
  o peor resultado con tan pocos datos).

- Abstención: si la probabilidad máxima es menor al umbral, el modelo responde
  None. Preferimos abstenernos a inventar (RNF-33): un dato inventado es peor
  que uno ausente, y lo ausente se resuelve en "Por revisar".
"""
from __future__ import annotations

from pathlib import Path

import joblib
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# Umbral de confianza por defecto para abstenerse. Se puede recalibrar con la
# curva precisión/cobertura (ver entrenar.py).
UMBRAL_DEFECTO = 0.55


def _nuevo_pipeline() -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            analyzer="char_wb",      # n-gramas de caracteres dentro de cada palabra
            ngram_range=(3, 5),
            min_df=1,
            sublinear_tf=True,
            lowercase=True,
        )),
        ("clf", LogisticRegression(
            max_iter=2000,
            C=10.0,
            class_weight="balanced",  # las categorías no están balanceadas
        )),
    ])


class ClasificadorGastos:
    """Envuelve el pipeline y la lógica de abstención. Serializable con joblib."""

    def __init__(self, umbral: float = UMBRAL_DEFECTO):
        self.umbral = umbral
        self.pipeline: Pipeline | None = None

    # ── entrenamiento ────────────────────────────────────────────────────────
    def entrenar(self, glosas: list[str], categorias: list[str]) -> "ClasificadorGastos":
        self.pipeline = _nuevo_pipeline()
        self.pipeline.fit(glosas, categorias)
        return self

    # ── inferencia ───────────────────────────────────────────────────────────
    def predecir(self, glosa: str) -> tuple[str | None, float]:
        """
        Devuelve (categoria, confianza). Si la confianza no alcanza el umbral,
        la categoría es None: el modelo se abstiene.
        """
        if self.pipeline is None:
            raise RuntimeError("El modelo no está entrenado ni cargado.")
        probas = self.pipeline.predict_proba([glosa])[0]
        i = int(probas.argmax())
        confianza = float(probas[i])
        categoria = self.pipeline.classes_[i]
        if confianza < self.umbral:
            return None, confianza
        return str(categoria), confianza

    def predecir_top(self, glosa: str, k: int = 3) -> list[tuple[str, float]]:
        """Las k categorías más probables, para sugerir en 'Por revisar'."""
        if self.pipeline is None:
            raise RuntimeError("El modelo no está entrenado ni cargado.")
        probas = self.pipeline.predict_proba([glosa])[0]
        orden = probas.argsort()[::-1][:k]
        return [(str(self.pipeline.classes_[i]), float(probas[i])) for i in orden]

    # ── persistencia ─────────────────────────────────────────────────────────
    def guardar(self, ruta: str | Path) -> None:
        ruta = Path(ruta)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"pipeline": self.pipeline, "umbral": self.umbral,
                     "sklearn": sklearn.__version__}, ruta)

    @classmethod
    def cargar(cls, ruta: str | Path) -> "ClasificadorGastos":
        """
        Carga un modelo guardado. Falla (ValueError) si se entrenó con otra
        versión de scikit-learn: un pickle de otra versión puede cargar y
        predecir mal sin avisar, así que mejor reentrenar (ver clasificar.py).
        """
        data = joblib.load(ruta)
        if data.get("sklearn") != sklearn.__version__:
            raise ValueError("modelo entrenado con scikit-learn %s; instalado %s"
                             % (data.get("sklearn"), sklearn.__version__))
        obj = cls(umbral=data["umbral"])
        obj.pipeline = data["pipeline"]
        return obj
