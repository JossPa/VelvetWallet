/**
 * Ficha: tarjeta con filas de "etiqueta — valor". Sirve para el detalle de
 * un movimiento, la trazabilidad, el resumen de un crédito, etc.
 *
 * `encabezado` es contenido libre arriba de las filas (p. ej. el monto grande).
 */
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";

export type FilaFicha = {
  etiqueta: string;
  valor: string;
  /** Muestra el valor en monoespaciada: glosas, referencias, identificadores. */
  mono?: boolean;
  /** Muestra el valor en color de acento: algo que requiere atención. */
  destacar?: boolean;
};

type Props = {
  filas: FilaFicha[];
  encabezado?: ReactNode;
};

export function Ficha({ filas, encabezado }: Props) {
  return (
    <View style={estilos.tarjeta}>
      {encabezado}
      {filas.map((f, i) => (
        <View key={f.etiqueta} style={[estilos.fila, i === 0 && !encabezado && estilos.primera]}>
          <Text style={estilos.etiqueta}>{f.etiqueta}</Text>
          <Text
            style={[estilos.valor, f.mono && estilos.mono, f.destacar && estilos.destacado]}
            numberOfLines={1}
          >
            {f.valor}
          </Text>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.xs,
  },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: espacio.m + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
    gap: espacio.l,
  },
  primera: { borderTopWidth: 0 },
  etiqueta: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15 },
  valor: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15, flexShrink: 1, textAlign: "right" },
  mono: { fontFamily: fuente.mono, fontSize: 14 },
  destacado: { color: colores.acento },
});
