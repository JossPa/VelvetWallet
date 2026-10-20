/**
 * Pila de la pestaña Metas: la lista y, encima, el detalle y el formulario.
 * Al ser una pila dentro de la pestaña, la barra inferior sigue visible.
 */
import { Stack } from "expo-router";

import { colores } from "@/constants/tema";

export default function LayoutMetas() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
  );
}
