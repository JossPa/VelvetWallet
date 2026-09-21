/**
 * Datos de desarrollo — movimientos.
 *
 * movimientos.json lo produce scripts/importar-simulador.mjs a partir de los
 * datos del simulador SFA. No se edita a mano; se regenera.
 *
 * El simulador genera cada mes completo, incluidos días que aún no llegan. Un
 * banco real solo entrega lo ocurrido, así que acá se descarta lo posterior a
 * este momento. Cuando la fuente sea el backend, este filtro sobra: la
 * sincronización nunca trae futuro.
 */
import type { Movimiento } from "@/modelo/tipos";

import datos from "./movimientos.json";

const ahora = new Date().toISOString();

export const MOVIMIENTOS: Movimiento[] = (datos as Movimiento[]).filter((m) => m.fecha <= ahora);
