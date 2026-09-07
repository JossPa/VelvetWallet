# Velvet Wallet

Aplicación móvil de finanzas personales para el mercado chileno, construida como **consumidor del
Sistema de Finanzas Abiertas (SFA)**.

Proyecto APT · Capstone APT122 · Ingeniería en Informática · Duoc UC, sede Puerto Montt

---

## De qué se trata

Los datos financieros de una persona están repartidos entre su banco, sus tarjetas y las fintech que
usa, y ninguna institución los entrega de forma que otro programa pueda leerlos. La alternativa es
anotar todo a mano, que es lo que hace abandonar cualquier aplicación de gastos.

La **Ley 21.521** creó el Sistema de Finanzas Abiertas, que obliga a las instituciones financieras a
entregar los datos del cliente por APIs estandarizadas cuando este lo autoriza. Entra en vigencia en
julio de 2027 y la Comisión para el Mercado Financiero ya publicó la especificación técnica.

Velvet Wallet es una implementación de referencia del lado que **consume** ese estándar, construida
en la ventana de preparación previa a su entrada en vigencia.

El usuario debe poder responder tres preguntas en segundos:

1. ¿Cuánto tengo disponible este mes?
2. ¿En qué se me va la plata?
3. ¿Cuándo voy a poder comprar lo que quiero?

---

## Estructura del repositorio

| Carpeta | Qué contiene | Estado |
|---|---|---|
| `simulador/` | Entidad financiera simulada conforme a la API de Cuentas del SFA | En desarrollo |
| `backend/` | API en FastAPI: ingesta, normalización y capas de inteligencia | Por iniciar |
| `movil/` | Aplicación en React Native + Expo | Por iniciar |
| `Fase 1/` | Evidencias entregadas de la primera fase de la asignatura | Entregado |

### Por qué existe el simulador

El SFA no está vigente, así que no es posible conectarse a instituciones reales. El simulador
implementa el lado **proveedor** del estándar contra la especificación pública de la CMF, lo que
obliga a entender e implementar ambos lados y no solo el del consumidor.

Corre en el puerto **8001**, separado del backend, para poder levantar los dos a la vez.

---

## Cómo levantar cada parte

### Simulador

```bash
cd simulador
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Documentación interactiva en `http://localhost:8001/docs`. Detalles en
[`simulador/README.md`](simulador/README.md).

### Backend

Por iniciar.

### Aplicación móvil

Por iniciar.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend y simulador | Python 3.12 · FastAPI · Pydantic |
| Persistencia | PostgreSQL · MongoDB · Redis |
| Inteligencia sobre los datos | scikit-learn · NumPy · pandas |
| Aplicación móvil | React Native · Expo · TypeScript |
| Estándar SFA | httpx · Authlib · mTLS · OpenAPI |

Se usan dos bases de datos por una razón de arquitectura, no por requisito: los payloads que
entregan las instituciones no tienen esquema fijo, porque cada una responde distinto. **PostgreSQL
guarda el modelo canónico ya normalizado; MongoDB guarda el dato crudo tal como llegó**, que además
es la base de la trazabilidad que exige la Ley 21.719.

---

## Convenciones de trabajo

### Ramas

Una rama corta por tarea, integrada mediante pull request:

```
feat/    funcionalidad nueva      feat/ingesta-deduplicacion
fix/     corrección               fix/paginacion-transacciones
chore/   mantención               chore/estructura-repo
docs/    documentación            docs/manual-despliegue
```

### Commits

Se sigue [Conventional Commits](https://www.conventionalcommits.org/es/):

```
feat(simulador): agrega filtros fromDate y toDate
fix(ingesta): evita duplicar movimientos que cambian de monto
```

**Cada integrante commitea con su propia cuenta.** El historial es la evidencia de aporte individual
que evalúa la asignatura, así que nunca se usa una cuenta compartida.

---

## Equipo

| Integrante | Correo |
|---|---|
| PADRON JOSSUE | jo.padron@duocuc.cl |
| TORRES PEDRO | ped.torres@duocuc.cl |
