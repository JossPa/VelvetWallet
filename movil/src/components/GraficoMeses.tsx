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
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, Pattern, Path, Rect } from "react-native-svg";

import { colores, espacio, fuente, radio } from "@/constants/tema";
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

        {serie.map((g) => {
          const activo = g.mes === seleccionado;
          const alto = alturaDe(g.total);
          return (
            <Pressable
              key={g.mes}
              onPress={() => onSeleccionar(g.mes)}
              style={({ pressed }) => [estilos.columna, pressed && estilos.presionada]}
            >
              <View style={estilos.zonaBarra}>
                {g.parcial ? (
                  // Rayado: el mes va a medias, no es comparable con los otros.
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
                ) : (
                  <View
                    style={[
                      estilos.barra,
                      { height: alto },
                      activo ? estilos.barraActiva : estilos.barraInactiva,
                    ]}
                  />
                )}
              </View>
              <Text style={[estilos.mes, activo && estilos.mesActivo]}>{etiqueta(g.mes)}</Text>
            </Pressable>
          );
        })}
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
  presionada: { opacity: 0.7 },
  zonaBarra: { width: "100%", justifyContent: "flex-end", flex: 1 },
  barra: { width: "100%", borderRadius: 4 },
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
