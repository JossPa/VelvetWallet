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
};

export const LOGOS: Record<string, LogoVectorial> = logos;

export const COMERCIOS: Record<string, EntradaComercio> = {
  // Con logo vectorial
  Netflix: { color: "#E50914", logo: "netflix" },
  Spotify: { color: "#1ED760", tinta: "#000000", logo: "spotify" },
  "Uber Eats": { color: "#06C167", logo: "ubereats" },
  iCloud: { color: "#3693F3", logo: "icloud" },
  "Mercado Pago": { color: "#00B1EA", logo: "mercadopago" },

  // Con color de marca, monograma mientras no haya logo
  Lider: { color: "#0071CE" },
  Unimarc: { color: "#E30613" },
  Copec: { color: "#003DA5" },
  Falabella: { color: "#7AB800" },
  "Smart Fit": { color: "#FFD400", tinta: "#000000" },
  "Farmacia Ahumada": { color: "#E4002B" },
  CGE: { color: "#F37021" },
  Essal: { color: "#00A3E0" },
  Abastible: { color: "#F7941D" },
  "Inmobiliaria Los Robles": { color: "#4E5D6C" },
};
