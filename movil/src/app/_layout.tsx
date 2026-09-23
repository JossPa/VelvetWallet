/**
 * Layout raíz de la aplicación.
 *
 * Decide qué zona se ve según haya sesión o no: (auth) para quien no entró,
 * (tabs) para quien sí. Ninguna pantalla de dentro necesita comprobarlo por su
 * cuenta, y no hay forma de llegar a ellas sin sesión escribiendo la ruta.
 *
 * Antes de mostrar nada carga las fuentes y revisa la sesión guardada: la
 * pantalla de arranque se mantiene hasta que ambas cosas estén listas.
 */
import { Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
} from "@expo-google-fonts/public-sans";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colores } from "@/constants/tema";
import { ProveedorSesion, useSesion } from "@/sesion/SesionContexto";

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

/**
 * Redirige entre las dos zonas cuando cambia la sesión. Va en un componente
 * aparte porque necesita estar dentro del proveedor para leerla.
 */
function Guardia() {
  const { usuario, cargando } = useSesion();
  const segmentos = useSegments();
  const router = useRouter();

  const enZonaAuth = segmentos[0] === "(auth)";

  useEffect(() => {
    if (cargando) return;
    if (!usuario && !enZonaAuth) router.replace("/sesion");
    else if (usuario && enZonaAuth) router.replace("/");
  }, [usuario, cargando, enZonaAuth, router]);

  return null;
}

function Raiz() {
  const { cargando } = useSesion();

  const [fuentesListas] = useFonts({
    Archivo_600SemiBold,
    Archivo_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    IBMPlexMono_500Medium,
  });

  const listo = fuentesListas && !cargando;

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  return (
    <ThemeProvider value={temaVelvet}>
      <StatusBar style="light" />
      <Guardia />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function LayoutRaiz() {
  return (
    <ProveedorSesion>
      <Raiz />
    </ProveedorSesion>
  );
}
