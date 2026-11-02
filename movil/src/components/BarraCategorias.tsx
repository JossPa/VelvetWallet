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
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Cifra } from "@/components/Cifra";
import { colores, espacio, fuente, movimiento as tiempos, radio } from "@/constants/tema";
import { Tocable, useMovimientoReducido } from "@/components/Movimiento";
import { usePaletaCategorias } from "@/utils/coloresCategoria";
import { pesos } from "@/utils/formato";
import type { PorcionCategoria } from "@/utils/resumen";

type Props = {
  porciones: PorcionCategoria[];
  total: number;
  /** Texto bajo el total: "en los últimos 6 meses". */
  periodo?: string;
  /** Si se entrega, cada fila del detalle abre el desglose de su categoría. */
  onSeleccionar?: (categoria: string) => void;
};

export function BarraCategorias({ porciones, total, periodo, onSeleccionar }: Props) {
  const reducido = useMovimientoReducido();
  const paleta = usePaletaCategorias();
  const ancho = useSharedValue(0);

  // La barra se despliega de izquierda a derecha al entrar. Se anima el ancho
  // del contenedor y no cada tramo por separado: así las proporciones nunca se
  // ven mal durante el recorrido, porque los tramos se reparten lo que haya.
  useEffect(() => {
    ancho.value = reducido ? 1 : withTiming(1, { duration: tiempos.lento });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducido]);

  const animado = useAnimatedStyle(() => ({ width: `${ancho.value * 100}%` }));

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.encabezado}>
        <Cifra valor={total} style={estilos.total} />
        {periodo ? <Text style={estilos.periodo}>{periodo}</Text> : null}
      </View>

      <View style={estilos.pista}>
        <Animated.View style={[estilos.barra, animado]}>
          {porciones.map((p) => (
            <View
              key={p.categoria}
              style={{
                // flex reparte el ancho en proporción exacta a cada fracción.
                flex: p.fraccion,
                backgroundColor: paleta.color(p.categoria),
              }}
            />
          ))}
        </Animated.View>
      </View>

      {/* Cada fila es la entrada al desglose de esa categoría. Sin
          `onSeleccionar` queda inerte: no se ofrece un toque que no lleva a
          ninguna parte. */}
      <View style={estilos.detalle}>
        {porciones.map((p) => {
          const contenido = (
            <>
              <View style={[estilos.punto, { backgroundColor: paleta.color(p.categoria) }]} />
              <Text style={estilos.nombre} numberOfLines={1}>{p.categoria}</Text>
              <Text style={estilos.monto}>{pesos(p.monto)}</Text>
              <Text style={estilos.porcentaje}>{Math.round(p.fraccion * 100)}%</Text>
              {onSeleccionar ? (
                <Ionicons name="chevron-forward" size={14} color={colores.texto3} />
              ) : null}
            </>
          );

          return onSeleccionar ? (
            <Tocable
              key={p.categoria}
              onPress={() => onSeleccionar(p.categoria)}
              style={estilos.fila}
            >
              {contenido}
            </Tocable>
          ) : (
            <View key={p.categoria} style={estilos.fila}>{contenido}</View>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  encabezado: { marginBottom: espacio.m },
  total: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 26, letterSpacing: -0.6 },
  periodo: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, marginTop: 2 },
  /** Reserva el alto desde el primer cuadro: la tarjeta no salta al crecer. */
  pista: { height: 14 },
  barra: {
    flexDirection: "row",
    height: 14,
    // El redondeo va en la barra y no en la pista para que la punta derecha
    // siga siendo redonda mientras avanza, en vez de ser un corte recto.
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
