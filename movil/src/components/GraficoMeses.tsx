/**
 * Gasto de los últimos meses, en barras.
 *
 * Responde la pregunta que no contesta una cifra sola: **cómo viene el gasto**.
 * Tocar una barra mueve el resto del panel a ese mes.
 *
 * Dos decisiones que se ven:
 *  · El mes en curso va rayado, porque está a medias. Pintarlo igual que los
 *    demás haría creer que el gasto bajó cuando solo falta que termine el mes.
 *  · Hay una línea de promedio que excluye el mes en curso, para que cada barra
 *    se lea contra algo y no en el vacío.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, Pattern, Path, Rect } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { Tocable, useMovimientoReducido } from "@/components/Movimiento";
import { colores, espacio, fuente, movimiento as tiempos, radio } from "@/constants/tema";
import { retraso } from "@/utils/animacion";
import { pesos } from "@/utils/formato";
import type { GastoDelMes } from "@/utils/resumen";

const ALTO = 120;
const SEPARACION = 8;

/** "2026-10" → "oct". Inicial en mayúscula para enero, que abre el año. */
const ABREVIATURA = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiqueta(mes: string): string {
  return ABREVIATURA[Number(mes.slice(5, 7)) - 1];
}

type Props = {
  serie: GastoDelMes[];
  promedio: number;
  /** Mes resaltado; el resto del panel lo sigue. */
  seleccionado: string;
  onSeleccionar: (mes: string) => void;
};

/**
 * Una columna del gráfico. Crece desde abajo cuando aparece.
 *
 * La barra se anima por su alto y no encogiéndola con una escala: escalar
 * deforma las esquinas redondeadas mientras dura el movimiento, y se nota.
 * El mes rayado se revela con una ventana que se abre desde el suelo, con el
 * dibujo anclado abajo, para que el rayado no se estire.
 */
function Columna({
  g,
  activo,
  alto,
  demora,
  onPress,
}: {
  g: GastoDelMes;
  activo: boolean;
  alto: number;
  demora: number;
  onPress: () => void;
}) {
  const reducido = useMovimientoReducido();
  const crecido = useSharedValue(0);

  useEffect(() => {
    crecido.value = reducido
      ? alto
      : withDelay(demora, withTiming(alto, { duration: tiempos.normal }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alto, reducido]);

  const animado = useAnimatedStyle(() => ({ height: crecido.value }));

  return (
    <Tocable onPress={onPress} style={estilos.columna}>
      <View style={estilos.zonaBarra}>
        {g.parcial ? (
          // Rayado: el mes va a medias, no es comparable con los otros.
          <Animated.View style={[estilos.ventana, animado]}>
            <View style={[estilos.anclado, { height: alto }]}>
              <Svg width="100%" height={alto}>
                <Defs>
                  <Pattern id="rayas" width={6} height={6} patternUnits="userSpaceOnUse">
                    <Path d="M0 6 L6 0" stroke={colores.acento} strokeWidth={2} />
                  </Pattern>
                </Defs>
                <Rect
                  x={0} y={0} width="100%" height={alto} rx={4}
                  fill="url(#rayas)"
                  stroke={colores.acento}
                  strokeWidth={activo ? 1.5 : 1}
                />
              </Svg>
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              estilos.barra,
              animado,
              activo ? estilos.barraActiva : estilos.barraInactiva,
            ]}
          />
        )}
      </View>
      <Text style={[estilos.mes, activo && estilos.mesActivo]}>{etiqueta(g.mes)}</Text>
    </Tocable>
  );
}

export function GraficoMeses({ serie, promedio, seleccionado, onSeleccionar }: Props) {
  const maximo = Math.max(...serie.map((g) => g.total), promedio, 1);
  const alturaDe = (total: number) => Math.max((total / maximo) * ALTO, total > 0 ? 3 : 0);

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.grafico}>
        {/* La línea del promedio cruza por detrás de las barras. */}
        {promedio > 0 ? (
          <View style={[estilos.lineaPromedio, { bottom: alturaDe(promedio) + 22 }]} pointerEvents="none">
            <Svg width="100%" height={1}>
              <Line
                x1="0" y1="0.5" x2="100%" y2="0.5"
                stroke={colores.texto3}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </Svg>
          </View>
        ) : null}

        {serie.map((g, i) => (
          <Columna
            key={g.mes}
            g={g}
            activo={g.mes === seleccionado}
            alto={alturaDe(g.total)}
            demora={retraso(i, 45)}
            onPress={() => onSeleccionar(g.mes)}
          />
        ))}
      </View>

      <View style={estilos.pie}>
        <Text style={estilos.pieTexto}>
          {promedio > 0 ? `Promedio mensual ${pesos(promedio)}` : "Aún no hay meses completos"}
        </Text>
        {serie.some((g) => g.parcial) ? (
          <Text style={estilos.pieNota}>El mes en curso va a medias</Text>
        ) : null}
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
  grafico: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: ALTO + 24,
    gap: SEPARACION,
  },
  lineaPromedio: { position: "absolute", left: 0, right: 0 },
  columna: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  zonaBarra: { width: "100%", justifyContent: "flex-end", flex: 1 },
  barra: { width: "100%", borderRadius: 4 },
  /** Ventana que se abre desde el suelo para revelar el mes rayado. */
  ventana: { width: "100%", overflow: "hidden", justifyContent: "flex-end" },
  anclado: { position: "absolute", bottom: 0, left: 0, right: 0 },
  barraActiva: { backgroundColor: colores.acento },
  barraInactiva: { backgroundColor: colores.chip },
  mes: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12, marginTop: 6 },
  mesActivo: { color: colores.texto, fontFamily: fuente.textoFuerte },
  pie: {
    marginTop: espacio.m,
    paddingTop: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
    gap: 2,
  },
  pieTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13 },
  pieNota: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12 },
});
