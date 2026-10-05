# Simulador de Entidad Financiera — SFA Chile

Banco simulado que implementa la **API de Cuentas** del Sistema de Finanzas Abiertas, conforme al
OpenAPI publicado por la Comisión para el Mercado Financiero.

Existe porque el SFA entra en vigencia en julio de 2027 y no es posible conectarse a instituciones
reales. Construirlo obliga a implementar **los dos lados del estándar**, no solo el del consumidor.

---

## Cómo levantarlo

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Corre en el **puerto 8001** a propósito: el backend de Velvet Wallet usa el 8000, así que se pueden
levantar los dos al mismo tiempo.

Documentación interactiva generada por FastAPI: `http://localhost:8001/docs`

## Cómo probarlo

```bash
curl http://localhost:8001/health
curl http://localhost:8001/accounts/v1/accounts
curl "http://localhost:8001/accounts/v1/accounts/CTA-0001/transactions?pageSize=3"
curl "http://localhost:8001/accounts/v1/accounts/CTA-0001/transactions?fromDate=2026-09-04"
```

---

## Estructura

```
spec/Accounts.yaml       Especificación oficial descargada del portal de la CMF
app/modelos_sfa.py       Modelos Pydantic GENERADOS desde el spec — no editar a mano
app/generador.py         Inventa 12 meses de historial. Se corre una vez
app/datos_banco.json     Lo que produce el generador — 270 movimientos
app/datos.py             Carga el JSON y define las cuentas
app/main.py              La aplicación: endpoints, paginación y filtros
```

### Regenerar los datos

```bash
python -m app.generador
```

Usa una **semilla fija**, así que siempre produce los mismos 270 movimientos. Los datos son
irregulares a propósito: las cuentas del hogar varían ±20% de monto y ±3 días de fecha, las
suscripciones se corren si caen en fin de semana, y hay movimientos sin comercio ni categoría para
forzar la abstención del clasificador.

## Endpoints de control — fuera del estándar

No son parte de la API conforme. Existen solo para poder probar la ingesta.

```bash
curl http://localhost:8001/simulador/estado          # qué está pendiente
curl -X POST http://localhost:8001/simulador/avanzar # confirma los pendientes
```

Al avanzar, las compras pre-autorizadas toman su monto definitivo **manteniendo el mismo
`transactionID`**. Eso es lo que la ingesta tiene que detectar para actualizar en vez de insertar.
Para volver al estado inicial basta reiniciar el servidor: los datos se cargan del JSON al arrancar.

### Los modelos se generan, no se escriben

```bash
python -m datamodel-code-generator \
  --input spec/Accounts.yaml --input-file-type openapi \
  --output app/modelos_sfa.py --target-python-version 3.11 \
  --use-schema-description --field-constraints
```

Dos razones: evita errores al transcribir 29 estructuras a mano, y permite afirmar que los schemas
**derivan de la especificación oficial**, no de una copia. Si la CMF publica una versión nueva del
spec, se regenera.

---

## Estado

| Implementado | Pendiente |
|---|---|
| Los 6 endpoints de la API de Cuentas | Flujo PAR y emisión de tokens |
| Envoltorio `data` / `links` / `meta` obligatorio | mTLS y certificados |
| Paginación `page` / `pageSize` | Firma JWS (`x-jws-signature`) |
| Filtros `fromDate` / `toDate` | |
| Error 404 en cuenta inexistente | |
| Generador de 12 meses de historial | |
| Ciclo de pendiente a confirmada | |

**El orden es deliberado:** primero que el banco entregue datos, después la seguridad encima. Partir
por mTLS significa pelear con certificados durante días antes de tener una sola línea de JSON.

---

## Hallazgos de la especificación

Dos cosas que salieron al leer el contrato y que afectan el diseño del modelo canónico:

**No existe campo de estado pendiente/confirmada.** El único `status` en las 29 estructuras del spec
está en `Accounts`, no en `Transactions`. Una transición de pendiente a confirmada se manifiesta como
el mismo `transactionID` reapareciendo con otro monto entre sincronizaciones, no como una bandera.

**El banco manda su propia categoría.** `merchantDetails.category` viene con el movimiento, pero es
**opcional** y sin taxonomía común: cada institución inventa la suya. El clasificador entonces no solo
clasifica desde cero, también normaliza taxonomías inconsistentes entre proveedores. En
`app/datos.py` hay movimientos con y sin ese campo justamente para cubrir los dos casos.

**Sobre los montos:** el spec declara `amount` como `number` y así viaja en JSON. Al persistirlo hay
que convertirlo a `Decimal`, nunca dejarlo en `float`.

---

## Pendiente menor

En `/accounts` los campos `firstAvailableDateTime` y `lastAvailableDateTime` se rellenan con la hora
actual, porque las cuentas no tienen fecha de movimiento. Funciona, pero sería más correcto usar
`openingDate`.
