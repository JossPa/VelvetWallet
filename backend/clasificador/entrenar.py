# -*- coding: utf-8 -*-
"""
Entrena el modelo y mide su desempeño. CLI:

    python -m clasificador.entrenar

Hace:
  1. Arma el dataset aumentado (glosas con ruido realista).
  2. Separa train/test estratificado.
  3. Entrena el modelo.
  4. Mide: exactitud, F1 macro, y —lo importante— la curva precisión/cobertura
     de la ABSTENCIÓN, comparada con el baseline de solo-reglas y con la cascada
     completa (reglas + modelo).
  5. Guarda el modelo (modelo.joblib) y el reporte (metricas.json).

La métrica que manda en este producto no es la exactitud a secas, sino:
  · cobertura  = % de movimientos a los que el sistema SÍ le pone categoría,
  · precisión  = de esos, cuántos acertó.
Abstenerse baja la cobertura pero sube la precisión: ese es el canje que el
umbral controla, y el que hay que defender en el informe.
"""
from __future__ import annotations

import json
from pathlib import Path

from sklearn.metrics import accuracy_score, f1_score

from .dataset import (COMERCIOS_NUEVOS, GLOSAS_SIN_COMERCIO, cargar_simulador,
                      generar_dataset, glosas_con_ruido)
from .modelo import UMBRAL_DEFECTO, ClasificadorGastos
from .reglas import clasificar_por_reglas

AQUI = Path(__file__).resolve().parent
POR_COMERCIO = 120


def entrenar_base(umbral: float = UMBRAL_DEFECTO, guardar: bool = True) -> ClasificadorGastos:
    """
    Entrena el modelo de producción con el dataset base (sin evaluar) y lo
    guarda. Es lo que corre la primera vez si no hay modelo.joblib.
    """
    train = generar_dataset("train", por_comercio=POR_COMERCIO)
    modelo = ClasificadorGastos(umbral=umbral).entrenar(
        [g for g, _ in train], [c for _, c in train])
    if guardar:
        modelo.guardar(AQUI / "modelo.joblib")
    return modelo


def _precision_cobertura(glosas, y_true, predecir_una):
    """
    predecir_una(glosa) -> categoria|None. Calcula cobertura y precisión sobre
    lo cubierto (lo que NO se abstuvo).
    """
    cubiertos = aciertos = 0
    for g, real in zip(glosas, y_true):
        pred = predecir_una(g)
        if pred is None:
            continue
        cubiertos += 1
        if pred == real:
            aciertos += 1
    cobertura = cubiertos / len(glosas) if glosas else 0.0
    precision = aciertos / cubiertos if cubiertos else 0.0
    return round(cobertura, 4), round(precision, 4)


def entrenar_y_evaluar(por_comercio: int = POR_COMERCIO, umbral: float = UMBRAL_DEFECTO,
                       ruta_simulador: str | Path | None = None) -> dict:
    # Entrenamiento con formas "vistas"; evaluación con formas OCULTAS (nunca
    # vistas tal cual). Es la prueba honesta de generalización.
    train = generar_dataset("train", por_comercio=por_comercio)
    test = generar_dataset("test", por_comercio=por_comercio)
    gl_tr, y_tr = [g for g, _ in train], [c for _, c in train]
    gl_te, y_te = [g for g, _ in test], [c for _, c in test]

    modelo = ClasificadorGastos(umbral=umbral).entrenar(gl_tr, y_tr)

    # Predicción cruda (sin abstención) para exactitud y F1.
    y_pred = [modelo.pipeline.predict([g])[0] for g in gl_te]
    exactitud = round(accuracy_score(y_te, y_pred), 4)
    f1_macro = round(f1_score(y_te, y_pred, average="macro"), 4)

    # Curva precisión/cobertura del MODELO según el umbral.
    curva = []
    for u in [0.0, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9]:
        m = ClasificadorGastos(umbral=u)
        m.pipeline = modelo.pipeline
        cob, pre = _precision_cobertura(gl_te, y_te, lambda g: m.predecir(g)[0])
        curva.append({"umbral": u, "cobertura": cob, "precision": pre})

    # Baselines, al umbral elegido.
    cob_reglas, pre_reglas = _precision_cobertura(gl_te, y_te, clasificar_por_reglas)
    cob_mod, pre_mod = _precision_cobertura(gl_te, y_te, lambda g: modelo.predecir(g)[0])

    def cascada_reglas_primero(g):
        r = clasificar_por_reglas(g)
        return r if r is not None else modelo.predecir(g)[0]

    def cascada_modelo_primero(g):
        # El modelo lidera (alta precisión); las reglas solo rescatan lo que el
        # modelo no supo (se abstuvo). Da la cobertura de ambos sin pagar el
        # costo de precisión de las reglas sobre ruido.
        cat = modelo.predecir(g)[0]
        return cat if cat is not None else clasificar_por_reglas(g)

    cob_cas, pre_cas = _precision_cobertura(gl_te, y_te, cascada_reglas_primero)
    cob_cas2, pre_cas2 = _precision_cobertura(gl_te, y_te, cascada_modelo_primero)

    # Prueba extra sobre las glosas LIMPIAS del simulador (nombres sin ruido):
    # tanto reglas como modelo deberían ir muy bien aquí.
    simulador = None
    if ruta_simulador and Path(ruta_simulador).exists():
        pares_sim = cargar_simulador(ruta_simulador)
        gl_sim = [g for g, _ in pares_sim]
        y_sim = [c for _, c in pares_sim]
        cob_r, pre_r = _precision_cobertura(gl_sim, y_sim, clasificar_por_reglas)
        cob_m, pre_m = _precision_cobertura(gl_sim, y_sim, lambda g: modelo.predecir(g)[0])
        simulador = {
            "n": len(pares_sim),
            "solo_reglas": {"cobertura": cob_r, "precision": pre_r},
            "solo_modelo": {"cobertura": cob_m, "precision": pre_m},
        }

    # La cascada de producción (clasificar.py): reglas primero.
    cascada = cascada_reglas_primero

    # Glosas SIN comercio (Transbank, PSP, PAC...): no dicen en qué se gastó.
    # Lo correcto es abstenerse; se mide cuántas veces lo hace.
    abst_modelo = sum(1 for g in GLOSAS_SIN_COMERCIO if modelo.predecir(g)[0] is None)
    abst_cascada = sum(1 for g in GLOSAS_SIN_COMERCIO if cascada(g) is None)

    # Comercios que el modelo NUNCA vio: lo esperado es acertar o abstenerse,
    # no inventar con seguridad. Se mide con ruido de cartola.
    nuevos = glosas_con_ruido(COMERCIOS_NUEVOS)
    cob_nm, pre_nm = _precision_cobertura([g for g, _ in nuevos], [c for _, c in nuevos],
                                          lambda g: modelo.predecir(g)[0])
    cob_nc, pre_nc = _precision_cobertura([g for g, _ in nuevos], [c for _, c in nuevos], cascada)

    reporte = {
        "n_train": len(gl_tr),
        "n_test_oculto": len(gl_te),
        "categorias": sorted(set(y_tr)),
        "simulador_glosas_limpias": simulador,
        "exactitud_sin_abstencion": exactitud,
        "f1_macro_sin_abstencion": f1_macro,
        "umbral_elegido": umbral,
        "cascada_en_produccion": "reglas_primero",
        "comparacion": {
            "solo_reglas":   {"cobertura": cob_reglas, "precision": pre_reglas},
            "solo_modelo":   {"cobertura": cob_mod,    "precision": pre_mod},
            "cascada_reglas_primero": {"cobertura": cob_cas,  "precision": pre_cas},
            "cascada_modelo_primero": {"cobertura": cob_cas2, "precision": pre_cas2},
        },
        "glosas_sin_comercio": {
            "n": len(GLOSAS_SIN_COMERCIO),
            "abstencion_modelo": round(abst_modelo / len(GLOSAS_SIN_COMERCIO), 4),
            "abstencion_cascada": round(abst_cascada / len(GLOSAS_SIN_COMERCIO), 4),
        },
        "comercios_nunca_vistos": {
            "n": len(nuevos),
            "solo_modelo": {"cobertura": cob_nm, "precision": pre_nm},
            "cascada": {"cobertura": cob_nc, "precision": pre_nc},
        },
        "curva_precision_cobertura": curva,
    }

    modelo.guardar(AQUI / "modelo.joblib")
    (AQUI / "metricas.json").write_text(
        json.dumps(reporte, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return reporte


def main():
    import sys
    ruta_sim = sys.argv[1] if len(sys.argv) > 1 else None
    r = entrenar_y_evaluar(ruta_simulador=ruta_sim)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    print("\nModelo guardado en modelo.joblib — reporte en metricas.json")


if __name__ == "__main__":
    main()
