/**
 * Selector de segmentos: una fila de opciones donde solo una está activa.
 * Genérico sobre el tipo de valor, para usarlo con cualquier conjunto fijo.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";

type Opcion<T extends string> = { valor: T; etiqueta: string };

type Props<T extends string> = {
  opciones: Opcion<T>[];
  valor: T;
  onCambio: (valor: T) => void;
};

export function Segmentos<T extends string>({ opciones, valor, onCambio }: Props<T>) {
  return (
    <View style={estilos.contenedor}>
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onCambio(o.valor)}
            style={[estilos.segmento, activa && estilos.segmentoActivo]}
          >
            <Text style={[estilos.texto, activa && estilos.textoActivo]}>{o.etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    padding: 4,
    marginBottom: espacio.l,
  },
  segmento: {
    flex: 1,
    paddingVertical: espacio.s + 2,
    borderRadius: radio.s + 2,
    alignItems: "center",
  },
  segmentoActivo: { backgroundColor: colores.chip },
  texto: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 15 },
  textoActivo: { color: colores.texto, fontFamily: fuente.textoFuerte },
});
