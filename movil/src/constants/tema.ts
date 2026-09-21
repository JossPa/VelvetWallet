/**
 * Tema visual de Velvet Wallet — modo oscuro.
 *
 * Los valores salen de los mockups de Fase 1 (paleta "negro").
 * Ningún componente debe escribir un color a mano: todo se importa de aquí.
 */

export const colores = {
  fondo: "#0D0D10",       // fondo de pantalla
  tarjeta: "#17181C",     // superficies elevadas: tarjetas, filas
  chip: "#232429",        // chips, pistas de barras de progreso

  texto: "#F2F2F5",       // texto principal
  texto2: "#A2A5AD",      // texto secundario
  texto3: "#6C6F77",      // texto terciario, etiquetas

  linea: "#26272D",       // divisores y bordes

  acento: "#EE3450",      // rojo Velvet: pestaña activa, montos destacados, acciones
  acentoSuave: "#2E141A", // fondo de chips con acento

  ok: "#3DD68C",          // conexión al día
  alerta: "#E0A33A",      // dato desactualizado, pendiente
  alertaSuave: "#2B2214",
} as const;

export const espacio = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
} as const;

export const radio = {
  s: 8,
  m: 12,
  l: 16,
} as const;
