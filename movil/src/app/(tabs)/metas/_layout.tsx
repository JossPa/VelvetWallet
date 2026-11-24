/**
 * Pila de la pestaña Metas: la lista y, encima, el detalle y el formulario.
 * Al ser una pila dentro de la pestaña, la barra inferior sigue visible.
 */
import { Stack } from "expo-router";

import { useColores } from "@/tema/TemaContexto";

export default function LayoutMetas() {
  const colores = useColores();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
  );
}
