/**
 * Historial inicial de movimientos.
 *
 * movimientos.json lo produce scripts/importar-simulador.mjs a partir de los
 * datos del simulador SFA. No se edita a mano; se regenera.
 *
 * Es el punto de partida: desde acá, la sincronización trae lo nuevo encima
 * (ver MovimientosContexto). Cuando exista el backend, el historial también
 * llegará por HTTP y este archivo desaparece.
 *
 * El simulador genera cada mes completo, incluidos días que aún no llegan. Un
 * banco real solo entrega lo ocurrido, así que acá se descarta lo posterior a
 * este momento.
 */
import type { Movimiento } from "@/modelo/tipos";

import datos from "./movimientos.json";

// Se compara por día, no por hora, igual que el filtro `toDate` del estándar.
// Si acá se descartara por hora exacta, los movimientos de hoy más tarde que
// este momento aparecerían como "nuevos" en la primera sincronización sin serlo.
const hoy = new Date().toISOString().slice(0, 10);

export const MOVIMIENTOS_INICIALES: Movimiento[] = (datos as Movimiento[]).filter(
  (m) => m.fecha.slice(0, 10) <= hoy,
);
