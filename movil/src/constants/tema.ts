/**
 * Tema visual de Velvet Wallet — modo oscuro.
 *
 * Los valores salen de los mockups de Fase 1 (paleta "negro").
 * Ningún componente debe escribir un color a mano: todo se importa de aquí.
 */

export const colores = {
  fondo: "#0D0D10",       // fondo de pantalla
  zona: "#1A1C21",        // nivel 1: la superficie que CONTIENE a otras
  tarjeta: "#17181C",     // nivel 2: tarjetas y filas sobre el fondo
  tarjetaAlta: "#1E2025", // superficie sobre otra superficie: bloques anidados
  chip: "#232429",        // nivel 3: chips, pistas de barras de progreso

  texto: "#F2F2F5",       // texto principal
  texto2: "#A2A5AD",      // texto secundario
  texto3: "#6C6F77",      // texto terciario, etiquetas

  linea: "#26272D",       // divisores y bordes

  /**
   * Borde de las superficies.
   *
   * La tarjeta (#17181C) y el fondo (#0D0D10) se separan por un 4% de
   * luminosidad: en pantalla se leen como manchas, no como superficies. Un
   * borde de un píxel a un 7% de blanco les devuelve el canto. Es lo que hace
   * que una interfaz oscura se vea construida en vez de improvisada.
   */
  borde: "rgba(255,255,255,0.07)",
  /** Borde de la superficie que está recibiendo el foco o va destacada. */
  bordeVivo: "rgba(255,255,255,0.13)",
  /**
   * Borde SUPERIOR de una superficie, más claro que los otros tres.
   *
   * Es el truco que separa una interfaz oscura correcta de una que se ve
   * construida: en el mundo real la luz cae desde arriba, así que el canto de
   * arriba de cualquier objeto brilla más que sus costados. Sin eso, en un
   * tema oscuro todo se lee como rectángulos planos de CSS. Va junto con el
   * degradado de `luz`, que es la otra mitad del mismo efecto.
   */
  bordeAlto: "rgba(255,255,255,0.11)",

  acento: "#EE3450",      // rojo Velvet: pestaña activa, montos destacados, acciones
  acentoSuave: "#2E141A", // fondo de chips con acento
  /** Borde de una superficie con acento, para que el bloque rojo tenga canto. */
  acentoBorde: "rgba(238,52,80,0.28)",

  ok: "#3DD68C",          // conexión al día
  alerta: "#E0A33A",      // dato desactualizado, pendiente
  alertaSuave: "#2B2214",
} as const;

/**
 * Tiempos y recorridos del movimiento.
 *
 * La regla, tomada de cómo se comportan las apps financieras buenas: **el
 * movimiento confirma, no entretiene.** Una cifra que cuenta desde cero dice
 * "esto se acaba de calcular"; un anillo que se dibuja dice "esto se armó con
 * tus datos". Nada se mueve porque sí, y nada se mueve dos veces.
 *
 * Los tiempos son cortos a propósito: por encima de ~600 ms la animación deja
 * de leerse como respuesta del sistema y empieza a leerse como demora.
 */
export const movimiento = {
  /** Reacción inmediata: presionar, soltar. */
  rapido: 140,
  /** Transición normal: aparecer, crecer. */
  normal: 320,
  /** Recorrido largo: cifras que cuentan, el anillo que se dibuja. */
  lento: 620,
  /** Retraso entre elementos de una entrada escalonada. */
  escalon: 55,
} as const;

/**
 * Tipografías del mockup. En React Native cada peso es una fuente aparte,
 * así que se elige por nombre completo y no con fontWeight.
 *
 *   titulo   Archivo      cabeceras, cifras grandes, nombres
 *   texto    Public Sans  todo lo demás
 *   mono     IBM Plex Mono glosas tal como las manda el banco
 */
export const fuente = {
  titulo: "Archivo_700Bold",
  tituloMedio: "Archivo_600SemiBold",
  texto: "PublicSans_400Regular",
  textoMedio: "PublicSans_500Medium",
  textoFuerte: "PublicSans_600SemiBold",
  mono: "IBMPlexMono_500Medium",
} as const;

/**
 * Colores del gráfico de categorías, del más gastado al menos.
 *
 * Es una escala del mismo rojo de la marca, no colores arbitrarios: el orden
 * de intensidad ya comunica el orden de magnitud. "Otros" va en gris para que
 * no compita con las categorías reales.
 */
export const paletaCategorias = ["#FF9FAC", "#F76A80", "#EE3450", "#C22740", "#8E1F2F"] as const;
export const colorOtros = "#4A4D55";

/**
 * Intensidad del degradado de las superficies, de arriba hacia abajo.
 *
 * La regla, que es la que separa el efecto bien hecho del mal hecho: **si se
 * nota dónde empieza y dónde termina el degradado, está muy fuerte.** Son
 * variaciones de luminosidad de 3 a 5%, no de 20. Se ve sin mirarlo.
 */
export const luz = {
  /** Superficie de nivel 1: la zona que contiene a otras. */
  zona: 0.045,
  /** Superficie de nivel 2: una tarjeta común. */
  tarjeta: 0.03,
  /** Hasta dónde llega el degradado antes de desaparecer, de 0 a 1. */
  alcance: 0.58,
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
  /**
   * Zona de nivel 1: la superficie que contiene tarjetas.
   *
   * 28 y no 20 para que la regla concéntrica cierre sin achatar lo de adentro:
   * con el relleno de 12 que usa la zona, 28 − 12 da justo los 16 de `l`, que
   * es el radio de cualquier tarjeta del resto de la app. Con 20 habría que
   * dejar las tarjetas anidadas en 8 y se verían cuadradas al lado de sus
   * iguales. Ver `radioInterior`.
   */
  xl: 28,
} as const;

/**
 * Radio de una esquina que va DENTRO de otra esquina redondeada.
 *
 * Dos rectángulos redondeados anidados solo se ven concéntricos si el interior
 * usa el radio del exterior menos el hueco que los separa. Con cualquier otro
 * valor las curvas no son paralelas y el ojo lo lee como "no calza", aunque no
 * sepa explicar por qué. Es el error que tenía la píldora de los segmentos:
 * radio 10 dentro de un contenedor de 12 con 4 de hueco, cuando correspondía 8.
 */
export function radioInterior(exterior: number, hueco: number): number {
  return Math.max(2, exterior - hueco);
}
