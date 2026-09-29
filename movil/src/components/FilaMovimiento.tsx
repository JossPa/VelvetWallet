/**
 * Un movimiento en la lista de Gastos.
 *
 * Lo que se muestra sale del modelo canónico: si no hay comercio identificado
 * se ve la glosa tal cual y el avatar pasa a "?" — el usuario tiene que saber
 * que ese dato está sin resolver, no verlo como uno más.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AvatarComercio } from "@/components/AvatarComercio";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import type { Movimiento } from "@/modelo/tipos";
import { fechaLista, pesos } from "@/utils/formato";

type Props = {
  movimiento: Movimiento;
  onPress?: (m: Movimiento) => void;
  /** Destaca la fila tras una sincronización. */
  novedad?: "nuevo" | "actualizado";
  /** Monto que tenía antes de actualizarse, para mostrar el cambio. */
  montoAnterior?: number;
};

export function FilaMovimiento({ movimiento: m, onPress, novedad, montoAnterior }: Props) {
  const sinIdentificar = m.estadoCategoria === "sin_categoria";
  const nombre = m.comercio ?? m.glosaOriginal;
  const subtitulo = `${m.excluido ? "No es gasto" : (m.categoria ?? "Sin categorizar")} · ${fechaLista(m.fecha)}`;

  return (
    <Pressable
      onPress={() => onPress?.(m)}
      style={({ pressed }) => [
        estilos.fila,
        novedad && estilos.destacada,
        m.excluido && estilos.atenuada,
        pressed && estilos.presionada,
      ]}
    >
      <AvatarComercio nombre={nombre} sinIdentificar={sinIdentificar} />

      <View style={estilos.centro}>
        <View style={estilos.lineaNombre}>
          <Text style={[estilos.nombre, sinIdentificar && estilos.nombreMono]} numberOfLines={1}>
            {nombre}
          </Text>
          {novedad ? (
            <View style={[estilos.etiqueta, estilos.etiquetaNovedad]}>
              <Text style={[estilos.etiquetaTexto, estilos.etiquetaTextoNovedad]}>
                {novedad === "nuevo" ? "NUEVO" : "ACTUALIZADO"}
              </Text>
            </View>
          ) : m.esRecurrente ? (
            <View style={estilos.etiqueta}>
              <Text style={estilos.etiquetaTexto}>MENSUAL</Text>
            </View>
          ) : null}
        </View>
        <Text style={estilos.subtitulo} numberOfLines={1}>{subtitulo}</Text>
      </View>

      <View style={estilos.columnaMonto}>
        <Text style={[estilos.monto, m.excluido && estilos.montoAtenuado]}>
          {pesos(Math.abs(m.monto))}
        </Text>
        {montoAnterior !== undefined ? (
          <Text style={estilos.montoAnterior}>antes {pesos(Math.abs(montoAnterior))}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: espacio.m + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.linea,
    gap: espacio.m,
  },
  atenuada: { opacity: 0.55 },
  presionada: { opacity: 0.7 },
  destacada: {
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.m,
    paddingHorizontal: espacio.m,
    marginHorizontal: -espacio.m,
    borderBottomColor: "transparent",
  },
  centro: { flex: 1, gap: 2 },
  lineaNombre: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  nombre: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17, flexShrink: 1 },
  nombreMono: { fontFamily: fuente.mono, fontSize: 15 },
  etiqueta: {
    backgroundColor: colores.chip,
    paddingHorizontal: espacio.s,
    paddingVertical: 2,
    borderRadius: radio.s,
  },
  etiquetaTexto: { color: colores.texto2, fontFamily: fuente.tituloMedio, fontSize: 10, letterSpacing: 0.8 },
  etiquetaNovedad: { backgroundColor: colores.acento },
  etiquetaTextoNovedad: { color: "#FFFFFF" },
  subtitulo: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14 },
  columnaMonto: { alignItems: "flex-end", gap: 2 },
  monto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 18, letterSpacing: -0.3 },
  montoAtenuado: { color: colores.texto2 },
  montoAnterior: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12 },
});
