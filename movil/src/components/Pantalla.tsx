/**
 * Marco común de toda pantalla y piezas de layout que se repiten.
 *
 * `SafeAreaView` evita que el contenido quede debajo de la muesca o la barra
 * de estado del teléfono. `etiqueta` es el chip de la derecha del mockup
 * ("Agosto", "3 conectadas", "1 activa").
 */
import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colores, espacio, fuente, radio } from "@/constants/tema";

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

/** Rótulo de sección en mayúsculas espaciadas: "TUS DATOS", "CORREGIR". */
export function Seccion({ titulo }: { titulo: string }) {
  return <Text style={estilos.seccion}>{titulo.toUpperCase()}</Text>;
}

/** Tarjeta gris de texto informativo, como la nota de confianza al pie de Cuentas. */
export function Nota({ children }: { children: ReactNode }) {
  return (
    <View style={estilos.nota}>
      <Text style={estilos.notaTexto}>{children}</Text>
    </View>
  );
}

/** Contenido provisional para las secciones que dependen de motores futuros. */
export function Proximamente({ que }: { que: string }) {
  return (
    <Nota>{que}</Nota>
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
  titulo: {
    color: colores.texto,
    fontFamily: fuente.titulo,
    fontSize: 30,
    letterSpacing: -0.6,
  },
  chip: {
    backgroundColor: colores.chip,
    paddingHorizontal: espacio.m,
    paddingVertical: 6,
    borderRadius: radio.l,
  },
  chipTexto: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 13 },
  seccion: {
    color: colores.texto3,
    fontFamily: fuente.tituloMedio,
    fontSize: 12,
    letterSpacing: 1.2,
    marginTop: espacio.xl,
    marginBottom: espacio.s,
  },
  nota: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    padding: espacio.l,
    marginTop: espacio.l,
  },
  notaTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 21 },
});
