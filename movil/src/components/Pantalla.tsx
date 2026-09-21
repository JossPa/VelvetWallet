/**
 * Marco común de toda pantalla y piezas de layout que se repiten.
 *
 * `SafeAreaView` evita que el contenido quede debajo de la muesca o la barra
 * de estado del teléfono. `etiqueta` es el chip de la derecha del mockup
 * ("Agosto", "3 conectadas", "1 activa").
 */
import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colores, espacio, fuente, radio } from "@/constants/tema";

type Props = {
  titulo: string;
  /** Chip de texto a la derecha del título. */
  etiqueta?: string;
  /** Control a la derecha del título (reemplaza al chip), p. ej. el selector de mes. */
  accesorio?: ReactNode;
  /** Si se entrega, muestra la flecha de volver a la izquierda del título. */
  onAtras?: () => void;
  /** Cabecera de marca (cuadrado rojo + nombre en mayúsculas) en vez del título grande. Solo Inicio. */
  marca?: boolean;
  children?: ReactNode;
};

export function Pantalla({ titulo, etiqueta, accesorio, onAtras, marca, children }: Props) {
  return (
    <SafeAreaView style={estilos.area} edges={["top"]}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.cabecera}>
          <View style={estilos.tituloConAtras}>
            {onAtras ? (
              <Pressable onPress={onAtras} hitSlop={12} style={estilos.atras}>
                <Ionicons name="chevron-back" size={26} color={colores.texto} />
              </Pressable>
            ) : null}
            {marca ? <View style={estilos.marcaCuadro} /> : null}
            <Text style={marca ? estilos.marcaTexto : estilos.titulo}>
              {marca ? titulo.toUpperCase() : titulo}
            </Text>
          </View>
          {accesorio ??
            (etiqueta ? (
              <View style={estilos.chip}>
                <Text style={estilos.chipTexto}>{etiqueta}</Text>
              </View>
            ) : null)}
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
  tituloConAtras: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  marcaCuadro: { width: 22, height: 22, borderRadius: 6, backgroundColor: colores.acento, marginRight: espacio.m },
  marcaTexto: { color: colores.texto2, fontFamily: fuente.tituloMedio, fontSize: 15, letterSpacing: 2 },
  atras: { marginLeft: -espacio.s, marginRight: espacio.xs },
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
