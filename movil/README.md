# Velvet Wallet — Aplicación móvil

Cliente móvil en **React Native + Expo**, con TypeScript y Expo Router.

## Cómo levantarla

```bash
npm install
npm run web        # en el navegador, para desarrollar
npm start          # muestra un QR para abrirla en el celular con Expo Go
```

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

## Convenciones

- **Colores solo desde `tema.ts`.** Salen de los mockups de Fase 1, paleta oscura.
- **Una pantalla por archivo** dentro de `src/app/`. La lógica compartida va en `components/`.
- Se usan las APIs estables de Expo Router (`Stack`, `Tabs`), no las marcadas `unstable`.

## Versiones

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript 6
