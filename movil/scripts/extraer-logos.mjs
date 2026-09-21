/**
 * Extrae de simple-icons solo los logos que usa el catálogo de comercios y
 * los escribe en src/datos/logos.json (trazado SVG + color de marca).
 *
 * simple-icons trae miles de marcas; empaquetarlo entero en la app sería
 * absurdo. Este script se corre al agregar una marca al catálogo:
 *
 *     node scripts/extraer-logos.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as iconos from "simple-icons";

const aqui = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(aqui, "../src/datos/logos.json");

// clave que usa el catálogo → export de simple-icons
const MARCAS = {
  netflix: "siNetflix",
  spotify: "siSpotify",
  ubereats: "siUbereats",
  icloud: "siIcloud",
  mercadopago: "siMercadopago",
};

const salida = {};
for (const [clave, exportado] of Object.entries(MARCAS)) {
  const icono = iconos[exportado];
  if (!icono) throw new Error(`simple-icons no tiene ${exportado}`);
  salida[clave] = { titulo: icono.title, color: "#" + icono.hex, trazado: icono.path };
}

writeFileSync(DESTINO, JSON.stringify(salida, null, 2) + "\n", "utf8");
console.log(`${Object.keys(salida).length} logos → ${DESTINO}`);
