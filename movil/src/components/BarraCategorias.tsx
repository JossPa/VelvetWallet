/**
 * Composición del gasto en una barra horizontal, con el detalle debajo.
 *
 * Se usa para el **período** de varios meses, mientras el anillo queda para el
 * mes. Dos gráficos iguales uno debajo del otro se confunden; la forma
 * distinta dice sola cuál es cuál: la barra es "de qué está hecho el total",
 * el anillo es "cómo se reparte este mes".
 *
 * También ocupa menos alto, que importa en una pantalla que ya es larga.
 */
import { StyleSheet, Text, View } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";
import { colorDeCategoria } from "@/components/GraficoCategorias";
import { pesos } from "@/utils/formato";
import type { PorcionCategoria } from "@/utils/resumen";

type Props = {
  porciones: PorcionCategoria[];
  total: number;
  /** Texto bajo el total: "en los últimos 6 meses". */
  periodo?: string;
};

export function BarraCategorias({ porciones, total, periodo }: Props) {
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.encabezado}>
        <Text style={estilos.total}>{pesos(total)}</Text>
        {periodo ? <Text style={estilos.periodo}>{periodo}</Text> : null}
      </View>

      <View style={estilos.barra}>
        {porciones.map((p, i) => (
          <View
            key={p.categoria}
            style={{
              // flex reparte el ancho en proporción exacta a cada fracción.
              flex: p.fraccion,
              backgroundColor: colorDeCategoria(p.categoria, i),
            }}
          />
        ))}
      </View>

      <View style={estilos.detalle}>
        {porciones.map((p, i) => (
          <View key={p.categoria} style={estilos.fila}>
            <View style={[estilos.punto, { backgroundColor: colorDeCategoria(p.categoria, i) }]} />
            <Text style={estilos.nombre} numberOfLines={1}>{p.categoria}</Text>
            <Text style={estilos.monto}>{pesos(p.monto)}</Text>
            <Text style={estilos.porcentaje}>{Math.round(p.fraccion * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  encabezado: { marginBottom: espacio.m },
  total: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 26, letterSpacing: -0.6 },
  periodo: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, marginTop: 2 },
  barra: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    gap: 2,
  },
  detalle: { marginTop: espacio.l, gap: espacio.m },
  fila: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  punto: { width: 10, height: 10, borderRadius: 3 },
  nombre: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, flex: 1 },
  monto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13 },
  porcentaje: {
    color: colores.texto,
    fontFamily: fuente.tituloMedio,
    fontSize: 14,
    minWidth: 38,
    textAlign: "right",
  },
});
