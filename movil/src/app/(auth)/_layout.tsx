/**
 * Zona sin sesión: inicio de sesión y registro. Sin barra de pestañas.
 */
import { Stack } from "expo-router";

import { useColores } from "@/tema/TemaContexto";

export default function LayoutAuth() {
  const colores = useColores();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colores.fondo },
        animation: "fade",
      }}
    />
  );
}
