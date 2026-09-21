/**
 * Catálogo de comercios — identidad visual.
 *
 * Primera capa del catálogo de la tarea E2: comercios conocidos, resueltos
 * sin modelo. Por ahora solo lo visual; después se le suman las reglas de
 * reconocimiento de glosas.
 *
 * Cómo se resuelve el avatar de un comercio, en orden:
 *   1. `imagen`  → un PNG local (assets/comercios/), para marcas sin vector
 *   2. `logo`    → trazado vectorial de src/datos/logos.json (simple-icons)
 *   3. ninguno   → monograma con el `color` de marca
 * Si el comercio no está en el catálogo, monograma gris.
 *
 * Para agregar un logo chileno: guardar el PNG con fondo transparente en
 * assets/comercios/<nombre>.png y anotar `imagen: require("@/assets/comercios/<nombre>.png")`.
 *
 * Los logos son marcas registradas de sus dueños. Se usan solo para que el
 * usuario identifique sus propias transacciones, que es el uso aceptado.
 */
import type { ImageSourcePropType } from "react-native";

import logos from "./logos.json";

export type LogoVectorial = { titulo: string; color: string; trazado: string };

export type EntradaComercio = {
  /** Color de fondo del avatar. */
  color: string;
  /** Color del texto o del trazado sobre ese fondo. Blanco por defecto. */
  tinta?: string;
  /** Clave en logos.json. */
  logo?: keyof typeof logos;
  /** Imagen local para marcas sin vector disponible. */
  imagen?: ImageSourcePropType;
  /**
   * Fracción del avatar que ocupa la imagen. 0.6 por defecto (símbolo con
   * aire alrededor); 1 cuando la imagen ya es un ícono de app completo.
   */
  escala?: number;
};

export const LOGOS: Record<string, LogoVectorial> = logos;

export const COMERCIOS: Record<string, EntradaComercio> = {
  // Con logo vectorial
  Netflix: { color: "#E50914", logo: "netflix" },
  Spotify: { color: "#1ED760", tinta: "#000000", logo: "spotify" },
  "Uber Eats": { color: "#06C167", logo: "ubereats" },
  iCloud: { color: "#3693F3", logo: "icloud" },
  "Mercado Pago": { color: "#00B1EA", logo: "mercadopago" },

  // Con imagen local. Los logos a color van sobre blanco; los que ya son un
  // ícono de app (cuadro de color) llenan el avatar con escala 1.
  Lider: { color: "#0071CE", imagen: require("@/assets/comercios/lider.png"), escala: 0.58 },
  Unimarc: { color: "#FFFFFF", imagen: require("@/assets/comercios/unimarc.png"), escala: 0.78 },
  Copec: { color: "#FFFFFF", imagen: require("@/assets/comercios/copec.png"), escala: 0.68 },
  Falabella: { color: "#FFFFFF", imagen: require("@/assets/comercios/falabella.png"), escala: 0.7 },
  "Smart Fit": { color: "#000000", imagen: require("@/assets/comercios/smart-fit.png"), escala: 0.72 },
  Jumbo: { color: "#FFFFFF", imagen: require("@/assets/comercios/jumbo.png"), escala: 0.9 },
  "Santa Isabel": { color: "#FFFFFF", imagen: require("@/assets/comercios/santa-isabel.png"), escala: 0.85 },

  // Instituciones (para la pantalla Cuentas)
  "Banco Santander": { color: "#FFFFFF", imagen: require("@/assets/comercios/santander.png"), escala: 0.66 },
  Itaú: { color: "#FF6200", imagen: require("@/assets/comercios/itau.png"), escala: 1 },

  // Con color de marca, monograma mientras no haya logo
  "Farmacia Ahumada": { color: "#E4002B" },
  CGE: { color: "#F37021" },
  Essal: { color: "#00A3E0" },
  Abastible: { color: "#F7941D" },
  "Inmobiliaria Los Robles": { color: "#4E5D6C" },
};
