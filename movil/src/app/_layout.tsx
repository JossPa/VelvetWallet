/**
 * Layout raíz de la aplicación.
 *
 * Es un Stack (pila de pantallas). Las pestañas son la primera entrada de la
 * pila; el detalle de un movimiento se apila encima y tapa la barra inferior.
 */
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colores } from "@/constants/tema";

// Partimos del tema oscuro de React Navigation y le ponemos nuestros colores,
// para que los fondos de transición y las cabeceras nativas calcen con la app.
const temaVelvet = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colores.fondo,
    card: colores.fondo,
    text: colores.texto,
    border: colores.linea,
    primary: colores.acento,
  },
};

export default function LayoutRaiz() {
  return (
    <ThemeProvider value={temaVelvet}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
