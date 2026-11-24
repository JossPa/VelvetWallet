/**
 * Tema visual de Velvet Wallet — modo oscuro y modo claro.
 *
 * Los valores salen de los mockups de Fase 1: la paleta "negro" (Mockups
 * Oscuro) y la clara (Mockups Claro). Ningún componente escribe un color a
 * mano ni importa una paleta directamente: los pide con `useColores()` o
 * `crearEstilos()` (src/tema/TemaContexto.tsx), que entregan la del tema
 * activo.
 */

/** Las dos paletas tienen exactamente las mismas claves. */
export type Paleta = {
  fondo: string;
  zona: string;
  tarjeta: string;
  tarjetaAlta: string;
  chip: string;
  texto: string;
  texto2: string;
  texto3: string;
  linea: string;
  borde: string;
  bordeVivo: string;
  bordeAlto: string;
  acento: string;
  acentoSuave: string;
  acentoBorde: string;
  /** Texto sobre un fondo `acento` (botones rojos): blanco en los dos temas. */
  sobreAcento: string;
  ok: string;
  /** Fondo de una acción afirmativa ("Sí, es esto"). */
  okSuave: string;
  alerta: string;
  alertaSuave: string;
  /** "Otros" en los gráficos de categorías: gris que no compite. */
  otros: string;
  /** Color de la luz de las superficies (ver `luz` y Superficie.tsx). */
  luz: string;
};

export const paletaOscura: Paleta = {
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
  okSuave: "#15291F",
  alerta: "#E0A33A",      // dato desactualizado, pendiente
  alertaSuave: "#2B2214",
  sobreAcento: "#FFFFFF",
  otros: "#4A4D55",
  luz: "#FFFFFF",
};

/**
 * Tema claro (Mockups Claro de Fase 1): fondo gris muy claro, tarjetas blancas.
 *
 * El rojo es más oscuro que el del tema oscuro: #EE3450 sobre blanco no llega
 * al contraste mínimo para texto (WCAG AA, 4.5:1); #C8102E sí. Los bordes son
 * negro translúcido en vez de blanco, y el canto de ARRIBA es el más tenue:
 * con luz desde arriba, el borde superior de un objeto claro casi no se ve.
 */
export const paletaClara: Paleta = {
  fondo: "#EEEFF3",
  zona: "#F7F7FA",
  tarjeta: "#FFFFFF",
  tarjetaAlta: "#F4F5F8",
  chip: "#E7E8ED",

  texto: "#16171B",
  texto2: "#4E5159",
  texto3: "#73767E",

  linea: "#E3E4E9",
  borde: "rgba(16,18,27,0.09)",
  bordeVivo: "rgba(16,18,27,0.18)",
  bordeAlto: "rgba(16,18,27,0.05)",

  acento: "#C8102E",
  acentoSuave: "#FBE6EA",
  acentoBorde: "rgba(200,16,46,0.24)",
  sobreAcento: "#FFFFFF",

  ok: "#138A52",
  okSuave: "#E1F4EA",
  alerta: "#A15C00",
  alertaSuave: "#FDF2DA",

  otros: "#C3C5CC",
  // Sobre blanco la luz no se vería: se usa un blanco que casi no aporta, y
  // la separación la hacen los bordes.
  luz: "#FFFFFF",
};

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
/** Gris de "Otros" del tema oscuro. En los componentes se usa `colores.otros`. */
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
