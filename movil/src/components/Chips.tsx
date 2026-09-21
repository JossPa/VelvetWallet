/**
 * Fila horizontal de chips seleccionables (una sola activa a la vez).
 * Se desliza si no caben; útil para listas que salen de los datos, como
 * las categorías presentes en un mes.
 */
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";

type Opcion<T extends string> = { valor: T; etiqueta: string };

type Props<T extends string> = {
  opciones: Opcion<T>[];
  valor: T;
  onCambio: (valor: T) => void;
};

export function Chips<T extends string>({ opciones, valor, onCambio }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.fila}
      style={estilos.contenedor}
    >
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onCambio(o.valor)}
            style={[estilos.chip, activa && estilos.chipActivo]}
          >
            <Text style={[estilos.texto, activa && estilos.textoActivo]}>{o.etiqueta}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginHorizontal: -espacio.l, marginBottom: espacio.l },
  fila: { paddingHorizontal: espacio.l, gap: espacio.s },
  chip: {
    paddingHorizontal: espacio.m,
    paddingVertical: 6,
    borderRadius: radio.l,
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
  },
  chipActivo: { backgroundColor: colores.acentoSuave, borderColor: colores.acento },
  texto: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 13 },
  textoActivo: { color: colores.acento },
});
