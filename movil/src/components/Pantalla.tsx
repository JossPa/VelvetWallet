/**
 * Marco común de toda pantalla: fondo, margen seguro y cabecera con título.
 *
 * `SafeAreaView` evita que el contenido quede debajo de la muesca o la barra
 * de estado del teléfono. `etiqueta` es el chip de la derecha del mockup
 * ("Agosto", "3 conectadas", "1 activa").
 */
import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colores, espacio, radio } from "@/constants/tema";

type Props = {
  titulo: string;
  etiqueta?: string;
  children?: ReactNode;
};

export function Pantalla({ titulo, etiqueta, children }: Props) {
  return (
    <SafeAreaView style={estilos.area} edges={["top"]}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.cabecera}>
          <Text style={estilos.titulo}>{titulo}</Text>
          {etiqueta ? (
            <View style={estilos.chip}>
              <Text style={estilos.chipTexto}>{etiqueta}</Text>
            </View>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Contenido provisional para las secciones que dependen de motores futuros. */
export function Proximamente({ que }: { que: string }) {
  return (
    <View style={estilos.vacio}>
      <Text style={estilos.vacioTexto}>{que}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l, paddingBottom: espacio.xl * 2 },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: espacio.xl,
  },
  titulo: { color: colores.texto, fontSize: 28, fontWeight: "700" },
  chip: {
    backgroundColor: colores.chip,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    borderRadius: radio.l,
  },
  chipTexto: { color: colores.texto2, fontSize: 13 },
  vacio: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    padding: espacio.xl,
    alignItems: "center",
  },
  vacioTexto: { color: colores.texto3, fontSize: 14, textAlign: "center" },
});
