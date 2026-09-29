/**
 * Cambio de gasto respecto al mes anterior, por categoría.
 *
 * Subir el gasto se pinta en rojo y bajarlo en verde. No es un juicio moral:
 * es la lectura por defecto en una app cuyo objetivo es que sobre plata.
 */
import { StyleSheet, Text, View } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";
import type { Variacion } from "@/utils/resumen";

function Fila({ v, destacada }: { v: Variacion; destacada?: boolean }) {
  const signo = v.porcentaje === null ? "" : v.porcentaje > 0 ? "+" : "−";
  const valor = v.porcentaje === null ? "—" : `${signo}${Math.abs(v.porcentaje)}%`;
  const color =
    v.porcentaje === null || v.porcentaje === 0
      ? colores.texto2
      : v.porcentaje > 0
        ? colores.acento
        : colores.ok;

  return (
    <View style={[estilos.fila, destacada && estilos.filaDestacada]}>
      <Text style={estilos.categoria}>{v.categoria}</Text>
      <Text style={[estilos.valor, { color }]}>{valor}</Text>
    </View>
  );
}

export function Comparacion({
  variaciones,
  total,
}: {
  variaciones: Variacion[];
  total: Variacion;
}) {
  return (
    <View style={estilos.tarjeta}>
      {variaciones.map((v) => (
        <Fila key={v.categoria} v={v} />
      ))}
      <Fila v={total} destacada />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.xs,
    marginTop: espacio.s,
  },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
  },
  filaDestacada: { borderTopColor: colores.texto3 },
  categoria: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15 },
  valor: { fontFamily: fuente.titulo, fontSize: 16 },
});
