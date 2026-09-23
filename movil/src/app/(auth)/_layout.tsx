/**
 * Zona sin sesión: inicio de sesión y registro. Sin barra de pestañas.
 */
import { Stack } from "expo-router";

import { colores } from "@/constants/tema";

export default function LayoutAuth() {
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
