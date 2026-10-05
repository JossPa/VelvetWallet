# Velvet Wallet — Bases de datos (Fase 1)

Entorno reproducible de los tres motores de datos del proyecto, levantable con
**un solo comando** (RNF-41). No necesitas instalar PostgreSQL, MongoDB ni Redis
en tu equipo: corren en contenedores.

## Contenido

```
docker-compose.yml            Define los tres servicios
.env.example                  Plantilla de credenciales (cópiala a .env)
db/postgres/init/01_schema.sql  DDL del modelo canónico (se ejecuta al iniciar)
db/mongo/init/01_init.js        Colecciones de Mongo (se ejecutan al iniciar)
```

## Requisitos

- Docker Desktop (con WSL2 activado si es Windows)

## Puesta en marcha

```bash
# 1. Copiar la plantilla de variables y (opcional) cambiar las contraseñas
cp .env.example .env

# 2. Levantar los tres motores
docker compose up -d

# 3. Ver que los tres quedaron "healthy"
docker compose ps
```

La **primera vez**, Postgres corre el DDL y Mongo crea sus colecciones de forma
automática. No hay que ejecutar nada más.

## Verificar que quedó todo creado

**PostgreSQL** — listar las tablas:
```bash
docker compose exec postgres psql -U velvet -d velvet_wallet -c "\dt"
```
Deberías ver las 11 tablas (usuario, institucion, categoria, conexion, cuenta,
consentimiento, suscripcion, meta, transaccion, correccion, bitacora_auditoria).

**MongoDB** — listar las colecciones:
```bash
docker compose exec mongo mongosh -u velvet -p velvet_wallet --quiet \
  --eval "db.getCollectionNames()"
```
Deberías ver: `payload_crudo`, `log`, `version_modelo`.

**Redis** — responder al ping:
```bash
docker compose exec redis redis-cli ping   # -> PONG
```

## Comandos útiles

| Acción | Comando |
|---|---|
| Detener (conservando datos) | `docker compose down` |
| Detener y **borrar** datos | `docker compose down -v` |
| Ver logs de un servicio | `docker compose logs -f postgres` |
| Reiniciar un servicio | `docker compose restart mongo` |

> Si modificas `01_schema.sql` o `01_init.js`, los scripts de init **solo
> vuelven a ejecutarse con los volúmenes vacíos**. Corre `docker compose down -v`
> y luego `up -d` para recrear desde cero. Cuando ya haya datos que no quieras
> perder, el cambio de esquema se hará con una migración de Alembic, no tocando
> el DDL de init.

## Si ya tienes datos cargados

El DDL de arriba agrega `transaccion.categoria_origen` (05-oct-2026). Si tu base ya tiene
movimientos, el init no se vuelve a ejecutar y hay que aplicarlo a mano **una sola vez**:

```bash
docker compose exec postgres psql -U velvet -d velvet_wallet -c "ALTER TABLE transaccion ADD COLUMN IF NOT EXISTS categoria_origen varchar(80);"
```

Alternativa si no te importa perder los datos de prueba: `docker compose down -v && docker compose up -d`
y volver a correr la ingesta.

> Este es el último cambio de esquema aplicado así. De aquí en adelante van por **Alembic**
> (tarea A8), que es justamente el problema que resuelve: aplicar el mismo cambio a una base
> que ya tiene datos, de forma versionada y reversible.

## Conexión desde el backend (más adelante)

Las cadenas de conexión están comentadas en `.env.example`. Apuntan a
`localhost` porque los puertos están publicados hacia tu equipo.
