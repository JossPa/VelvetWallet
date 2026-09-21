/**
 * Datos de desarrollo — movimientos.
 *
 * movimientos.json lo produce scripts/importar-simulador.mjs a partir de los
 * datos del simulador SFA. No se edita a mano; se regenera.
 */
import type { Movimiento } from "@/modelo/tipos";

import datos from "./movimientos.json";

export const MOVIMIENTOS: Movimiento[] = datos as Movimiento[];
