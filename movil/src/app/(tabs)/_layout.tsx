/**
 * Barra de pestañas inferior — las cinco secciones del mockup.
 *
 * Cada <Tabs.Screen name="x"> corresponde al archivo x.tsx de esta carpeta.
 * El orden acá es el orden en que aparecen en la barra.
 */
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colores } from "@/constants/tema";
import { contarNovedades, useMovimientos } from "@/datos/MovimientosContexto";

type NombreIcono = keyof typeof Ionicons.glyphMap;

function icono(nombre: NombreIcono) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={nombre} color={color} size={size} />
  );
}

export default function LayoutPestanas() {
  const { novedades } = useMovimientos();
  const sinVer = contarNovedades(novedades);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.acento,
        tabBarInactiveTintColor: colores.texto3,
        tabBarStyle: {
          backgroundColor: colores.fondo,
          borderTopColor: colores.linea,
          // Altura fija: en web no hay "zona segura" inferior y sin esto
          // la etiqueta queda cortada. En el celular se suma el margen del
          // sistema automáticamente.
          height: 68,
          paddingTop: 2,
          paddingBottom: 4,
        },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: colores.fondo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: icono("home") }} />
      <Tabs.Screen
        name="gastos"
        options={{
          title: "Gastos",
          tabBarIcon: icono("list"),
          // Contador de movimientos sin mirar tras la última sincronización.
          tabBarBadge: sinVer > 0 ? sinVer : undefined,
          tabBarBadgeStyle: { backgroundColor: colores.acento, color: "#FFFFFF", fontSize: 11 },
        }}
      />
      <Tabs.Screen name="metas" options={{ title: "Metas", tabBarIcon: icono("flag") }} />
      <Tabs.Screen name="deudas" options={{ title: "Deudas", tabBarIcon: icono("card") }} />
      <Tabs.Screen name="cuentas" options={{ title: "Cuentas", tabBarIcon: icono("wallet") }} />
    </Tabs>
  );
}
