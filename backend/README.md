# Backend — Ingesta y normalización (bloque D)

Lee los datos del proveedor SFA y los deja en las dos bases: el crudo en MongoDB
y el modelo canónico en PostgreSQL.

## Diseño en capas (por qué sirve para el banco real)

El código está separado para que pasar del simulador a un banco real cambie
**solo la URL y la autenticación**, nada más:

```
ingesta/
├── config.py        URLs y credenciales (lo único que cambia entre entornos)
├── cliente_sfa.py   Habla el estándar SFA. Aquí van mTLS y OAuth del banco real
├── normalizador.py  SFA → modelo canónico (monto con signo, hash). No sabe de red ni de BD
├── repositorio.py   Escribe: crudo en Mongo, UPSERT en Postgres
├── bootstrap.py     Siembra usuario/institución/conexión (mientras no hay OAuth)
└── sincronizar.py   Orquesta todo. Punto de entrada
```

El simulador ya habla el mismo estándar de la CMF, así que `normalizador` y
`repositorio` **no se tocan** cuando llegue un banco de verdad.

## Requisitos previos

1. Bases arriba:  desde `BD/`  →  `docker compose up -d`
2. Simulador arriba:  desde `simulador/`  →  `uvicorn app.main:app --reload --port 8001`

## Puesta en marcha

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate         # Windows PowerShell
pip install -r requirements.txt
cp .env.example .env             # ajusta credenciales si cambiaste las de BD/.env
python -m ingesta.sincronizar
```

Salida esperada (primera corrida):

```
Sincronización lista:
  Consentimiento     : urn:velvet:consent:...
  Cuentas procesadas : 2
  Movimientos nuevos : 271
  Movimientos actualizados: 0
  Sin cambios        : 0
```

Las tres cifras son distintas a propósito: **nuevos** son los que no existían,
**actualizados** los que el banco mandó distinto, y **sin cambios** los que llegaron
exactamente igual y no se tocaron. Si todo cayera en "actualizados" en cada corrida, el
número no diría nada.

## Probar el ciclo pendiente → confirmada

Esto es lo que justifica el `id_externo` y el UPSERT del esquema:

```bash
# 1. Primera ingesta (ya hecha arriba): N movimientos insertados.
# 2. Un pago nuevo que llega pre-autorizado:
curl -X POST "http://localhost:8001/simulador/nuevo-pago?pendiente=true"
python -m ingesta.sincronizar          # -> nuevos: 1
# 3. El banco lo confirma con otro monto, mismo transactionID:
curl -X POST http://localhost:8001/simulador/avanzar
python -m ingesta.sincronizar          # -> nuevos: 0, actualizados: 1
```

**"Movimientos nuevos" debe ser 0 en el paso 3**, y el total de filas no debe subir:
el movimiento cambió de monto pero es el mismo. Si el conteo de nuevos sube, el UPSERT
no está funcionando.

Comprobado con:

```bash
docker compose -f ../BD/docker-compose.yml exec postgres \
  psql -U velvet -d velvet_wallet -c "SELECT count(*), count(DISTINCT id_externo) FROM transaccion;"
```

Los dos números deben ser iguales: un movimiento del banco, una fila.

## Verificar en la base

```bash
docker compose -f ../BD/docker-compose.yml exec postgres \
  psql -U velvet -d velvet_wallet -c "SELECT count(*), sum(monto) FROM transaccion;"
```

El `sum(monto)` es, literalmente, el saldo: cargos negativos y abonos positivos.
