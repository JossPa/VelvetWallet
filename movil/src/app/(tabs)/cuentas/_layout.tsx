/**
 * Pila de la pestaña Cuentas: las instituciones y, encima, privacidad.
 * Al ser una pila dentro de la pestaña, la barra inferior sigue visible.
 */
import { Stack } from "expo-router";

import { useColores } from "@/tema/TemaContexto";

export default function LayoutCuentas() {
  const colores = useColores();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
  );
}
