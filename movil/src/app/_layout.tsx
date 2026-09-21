/**
 * Layout raíz de la aplicación.
 *
 * Es un Stack (pila de pantallas). Las pestañas son la primera entrada de la
 * pila; el detalle de un movimiento se apila encima y tapa la barra inferior.
 *
 * Antes de mostrar nada carga las fuentes: la pantalla de arranque se mantiene
 * visible hasta que estén listas, para no ver un parpadeo de tipografía.
 */
import { Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
} from "@expo-google-fonts/public-sans";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colores } from "@/constants/tema";

SplashScreen.preventAutoHideAsync();

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
  const [fuentesListas] = useFonts({
    Archivo_600SemiBold,
    Archivo_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fuentesListas) SplashScreen.hideAsync();
  }, [fuentesListas]);

  if (!fuentesListas) return null;

  return (
    <ThemeProvider value={temaVelvet}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
