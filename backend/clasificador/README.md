# Clasificador de gastos (bloque E)

Lleva cada gasto que llega del banco a una categoría de Velvet Wallet. Corre en
la ingesta, así que la app recibe la categoría ya puesta. Cuando no está seguro
**se abstiene** y el movimiento cae en **"Por revisar"**: nunca inventa (RF-17,
RNF-33).

```
glosa ──► 1) reglas   ─► categoría   (reconoció el nombre del comercio)
          2) modelo   ─► categoría   (si su confianza supera 0,55)
          3) abstención ─► sin categoría → "Por revisar"
```

## Cómo se conecta con el resto

| Dónde | Qué hace |
|---|---|
| `ingesta/normalizador.py` | `categoria_propuesta()`: clasifica cada **gasto** (los abonos no). |
| `ingesta/repositorio.py` | Guarda `categoria_id` y `confianza_clasificacion`. Al re-sincronizar recalcula, **salvo que el usuario la haya corregido**. Después clasifica los gastos que siguieran sin categoría (de antes del clasificador). |
| `api/datos.py` | Entrega `categoria`, `origenClasificacion` (`regla`, `modelo`, `banco`, `usuario`) y `confianza`. `PUT /api/movimientos/{id}/categoria` guarda la corrección del usuario en `correccion`. |
| App | Ya no clasifica por su cuenta. "Por revisar" guarda la elección en el backend; si falla, la deshace y avisa. |

`confianza_clasificacion` queda en NULL cuando decidió una regla: una regla
acierta o no, no tiene confianza parcial. Por eso la API sabe si fue regla o
modelo.

## Resultados (`metricas.json`)

38 comercios de los tres perfiles de la EFS, 13 categorías. El modelo se mide con
formas del nombre que **nunca vio** al entrenar (abreviaturas, erratas, prefijos
de medio de pago).

| Estrategia, sobre glosas no vistas | Cobertura | Precisión |
|---|---|---|
| Solo reglas | 52 % | 100 % |
| Solo modelo | 89 % | 98,4 % |
| Modelo primero, reglas de respaldo | 90 % | 98,5 % |
| **Reglas primero, modelo de respaldo (la que corre)** | **90 %** | **100 %** |

- **Glosas sin comercio** (`TRANSBANK*CL 8829`, `PAGO PSP 4471`…): se abstiene en las 12 de 12.
- **Comercios que el modelo nunca vio** (Acuenta, Salcobrand, Cabify…): solo, el
  modelo cubre el 13 % y acierta el 38 % de eso, porque se confunde con nombres
  parecidos. Con las reglas delante, la cascada cubre el 100 % con 100 % de
  precisión. **Cuidado al leer esta cifra:** varias de esas reglas se escribieron
  conociendo la lista. Lo que sí dice es que un comercio nuevo no lo resuelve el
  modelo sin ejemplos: lo resuelve una regla o una corrección del usuario.
- Por eso se cambió el orden de la cascada a **reglas primero**: el modelo
  ponía "METRO GAS" en Transporte (por "METRO") con mucha confianza, y la regla
  acierta. La regla de Metrogas se ajustó después de ver ese error en la
  evaluación.

## Reentrenar con las correcciones (E6)

```bash
python -m clasificador.reentrenar        # desde backend/
```

- Usa **solo** las correcciones de quienes tienen vigente el consentimiento
  "entrenamiento_modelos" (`api/privacidad.py`). Entrena desde cero cada vez:
  si alguien revoca, sus ejemplos salen del modelo siguiente.
- Descarta las correcciones sobre glosas que **no nombran un comercio**
  (`TRANSBANK*CL 7781`): sirven para ese movimiento, pero el modelo aprendería
  que todo lo que pasa por Transbank es, por ejemplo, "Seguros".
- **Guardia de regresión:** si el modelo nuevo es peor en el test oculto, no se
  guarda. Ejemplo real: corregir Jumbo → Hogar baja la exactitud de 96,1 % a
  95,0 % y se rechaza.
- Si guarda, reclasifica los gastos que nadie corrigió.

Así aprende categorías nuevas: tras corregir `PAC SEGURO 0042` → "Seguros", el
siguiente `PAC SEGURO 0099` llega ya como Seguros, por el modelo, con 95 % de
confianza (ver `prueba_clasificador_e2e.py`).

## El modelo

TF-IDF de n-gramas de caracteres (3 a 5) + Regresión Logística. Los n-gramas
de caracteres aguantan abreviaturas y erratas ("NETFLX", "FALABELA") sin
diccionario. Es lineal, rápido y explicable; con 13 clases y miles de ejemplos
no hace falta nada más pesado.

`modelo.joblib` **no se versiona**: si no existe, o se entrenó con otra versión
de scikit-learn, se entrena solo la primera vez que se clasifica (unos
segundos, determinista). Si scikit-learn no está instalado, la cascada sigue
con las reglas y se abstiene en lo demás.

```bash
python -m clasificador.entrenar ..\simulador\app\datos_banco.json   # reentrena base + metricas.json
python -m pytest                                                     # pruebas (desde backend/)
```

| Archivo | Qué hace |
|---|---|
| `taxonomia.py` | Las 13 categorías y el mapeo comercio → categoría. |
| `reglas.py` | Reglas por nombre de comercio (capa 1). |
| `dataset.py` | Glosas con ruido de cartola; formas vistas (entrenar) y ocultas (medir). |
| `modelo.py` | `ClasificadorGastos`: el pipeline y la abstención. |
| `clasificar.py` | La cascada: lo que llama la ingesta. |
| `entrenar.py` | Entrena, mide y escribe `metricas.json`. |
| `reentrenar.py` | Reentrena con correcciones consentidas y reclasifica. |
