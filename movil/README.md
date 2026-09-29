# Velvet Wallet — Aplicación móvil

Cliente móvil en **React Native + Expo**, con TypeScript y Expo Router.

## Cómo levantarla

```bash
npm install
npm run web        # en el navegador, para desarrollar
npm start          # muestra un QR para abrirla en el celular con Expo Go
```

### Credenciales de prueba

| | |
|---|---|
| **Correo** | `demo@velvetwallet.cl` |
| **Contraseña** | `velvet2026` |

Están escritas en la propia pantalla de inicio de sesión. También se puede crear una cuenta nueva
desde el enlace *Crear una*.

> Son credenciales de desarrollo: la cuenta está definida en `src/servicios/auth.ts` y desaparece
> cuando ese archivo pase a llamar al backend real. No hay ninguna contraseña real en el repositorio.

Para levantar además el banco simulado y demostrar un pago llegando, ver [`DEMO.md`](../DEMO.md).

## Estructura

```
app.json                 identidad de la app: nombre, esquema de enlaces, modo oscuro
src/
├── app/                 PANTALLAS. Cada archivo es una ruta (Expo Router)
│   ├── _layout.tsx      raíz: pila de pantallas con el tema
│   └── (tabs)/          las cinco pestañas: inicio, gastos, metas, deudas, cuentas
├── components/          piezas reutilizables
└── constants/tema.ts    colores y espaciados. Ningún componente escribe un color a mano
```

## Pruebas

```bash
npm test               # corre todas
npm test -- --coverage # además mide cobertura
```

Se prueban las **funciones de cálculo** (`src/utils/`): son puras —entra algo,
sale algo, sin pantallas ni red— así que son las más baratas de probar y las que
más importa que estén bien, porque de ahí salen todas las cifras que ve el
usuario.

| Archivo | Qué verifica |
|---|---|
| `fusion.prueba.ts` | El upsert: insertar, actualizar sin duplicar, y que las correcciones del usuario sobrevivan a resincronizar (RF-14) |
| `resumen.prueba.ts` | Disponible del mes, reparto por categoría, comparación mensual |
| `sugerencias.prueba.ts` | Que las reglas reconozcan comercios y, sobre todo, que **declaren cuándo no saben** |
| `formato.prueba.ts` | Pesos con signo y separador de miles, fechas relativas |

**57 pruebas · 96% de cobertura · `fusion.ts` al 100%.**

Las de `fusion.ts` son las más importantes del proyecto: ahí está el caso que
rompe las aplicaciones de finanzas. Comprobarlo a mano toma cinco minutos
—levantar el simulador, la app, sincronizar, inyectar, sincronizar— y depende de
mirar bien. La prueba lo hace en dos segundos y no se olvida de ningún caso.

## Pendientes anotados

Cosas decididas pero no implementadas, para no perderlas de vista.

| # | Pendiente | Cuándo |
|---|---|---|
| 1 | **Conectar al backend.** Hoy `servicios/sincronizacion.ts` llama al simulador directo y normaliza en el dispositivo. El propio archivo lista punto por punto qué cambiar | Cuando existan los endpoints |
| 2 | **Datos por usuario.** Los movimientos son un archivo dentro de la app: cualquiera que entre ve los mismos. Con backend, cada movimiento queda atado a su `usuario_id` | Junto al punto 1 |
| 3 | **Autenticación real.** `servicios/auth.ts` simula el backend; las cuentas viven en memoria y no sobreviven a reinstalar la app. Recuperar la cuenta en un teléfono nuevo requiere que los datos estén en el servidor | Junto al punto 1 |
| 4 | **Saldo proyectado.** El espacio está reservado en Inicio; se activa con el motor Monte Carlo | Semanas 12-13 |
| 5 | **Acciones de corrección.** Los cuatro botones del detalle no hacen nada: una corrección se persiste, así que necesita backend | Bloque D9 |

### Opcional — bloqueo biométrico

Si el teléfono se pierde o lo roban **con la sesión abierta**, quien lo tenga entra sin contraseña,
porque el token está guardado justamente para no pedirla cada vez. Un bloqueo por huella o rostro al
abrir la aplicación lo evita, y en Expo es un paquete (`expo-local-authentication`).

Queda como **opcional**: no está comprometido en los entregables y no bloquea nada. Encaja con el
bloque de cumplimiento de la Ley 21.719 (semanas 11-14), junto con cerrar sesión en todos los
dispositivos y acortar la vigencia del token.

## Convenciones

- **Colores solo desde `tema.ts`.** Salen de los mockups de Fase 1, paleta oscura.
- **Una pantalla por archivo** dentro de `src/app/`. La lógica compartida va en `components/`.
- Se usan las APIs estables de Expo Router (`Stack`, `Tabs`), no las marcadas `unstable`.

## Versiones

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript 6
