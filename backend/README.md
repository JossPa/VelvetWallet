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
  Cuentas procesadas : 2
  Movimientos nuevos : 271
  Movimientos actualizados: 0
```

## Probar el ciclo pendiente → confirmada

Esto es lo que justifica el `id_externo` y el UPSERT del esquema:

```bash
# 1. Primera ingesta (ya hecha arriba): N movimientos insertados.
# 2. Avanzar el tiempo en el simulador (confirma los pendientes):
curl -X POST http://localhost:8001/simulador/avanzar
# 3. Volver a ingerir:
python -m ingesta.sincronizar
```

En la segunda corrida, **"Movimientos nuevos" debe ser 0** y aparecen varios en
"actualizados": son las compras que se confirmaron con otro monto. Si el conteo
de nuevos sube, el UPSERT no está funcionando.

## Verificar en la base

```bash
docker compose -f ../BD/docker-compose.yml exec postgres \
  psql -U velvet -d velvet_wallet -c "SELECT count(*), sum(monto) FROM transaccion;"
```

El `sum(monto)` es, literalmente, el saldo: cargos negativos y abonos positivos.
