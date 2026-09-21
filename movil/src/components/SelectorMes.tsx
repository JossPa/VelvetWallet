/**
 * Selector de mes con flechas: ‹ Septiembre ›
 *
 * `meses` son las claves "AAAA-MM" que tienen datos, de la más reciente a la
 * más antigua. Las flechas se desactivan en los extremos.
 */
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";
import { nombreMes } from "@/utils/formato";

type Props = {
  meses: string[];
  valor: string;
  onCambio: (mes: string) => void;
};

export function SelectorMes({ meses, valor, onCambio }: Props) {
  const indice = meses.indexOf(valor);
  const hayAnterior = indice < meses.length - 1; // más antiguo
  const haySiguiente = indice > 0;               // más reciente

  return (
    <View style={estilos.contenedor}>
      <Flecha nombre="chevron-back" activa={hayAnterior} onPress={() => onCambio(meses[indice + 1])} />
      <Text style={estilos.mes}>{nombreMes(valor)}</Text>
      <Flecha nombre="chevron-forward" activa={haySiguiente} onPress={() => onCambio(meses[indice - 1])} />
    </View>
  );
}

function Flecha({ nombre, activa, onPress }: { nombre: "chevron-back" | "chevron-forward"; activa: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!activa} hitSlop={8} style={estilos.flecha}>
      <Ionicons name={nombre} size={16} color={activa ? colores.texto : colores.linea} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colores.chip,
    borderRadius: radio.l,
    paddingHorizontal: espacio.xs,
    paddingVertical: 2,
  },
  flecha: { padding: espacio.xs },
  mes: {
    color: colores.texto2,
    fontFamily: fuente.textoMedio,
    fontSize: 13,
    minWidth: 84,
    textAlign: "center",
  },
});
