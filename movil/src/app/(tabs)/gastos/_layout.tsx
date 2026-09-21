/**
 * Pila de la pestaña Gastos: la lista y, encima, el detalle de un movimiento.
 * Al ser una pila dentro de la pestaña, la barra inferior se mantiene visible
 * y Gastos sigue marcada como activa mientras se ve el detalle.
 */
import { Stack } from "expo-router";

import { colores } from "@/constants/tema";

export default function LayoutGastos() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
  );
}
