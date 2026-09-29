/**
 * Anillo de gasto por categoría, con el total al centro.
 *
 * Cada porción es un arco dibujado por ángulos: se parte arriba (12 en punto)
 * y se avanza en el sentido del reloj según la fracción que ocupa cada una.
 */
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colorOtros, colores, espacio, fuente, paletaCategorias, radio } from "@/constants/tema";
import type { PorcionCategoria } from "@/utils/resumen";
import { pesos } from "@/utils/formato";

const LADO = 180;
const GROSOR = 26;
const RADIO = (LADO - GROSOR) / 2;
const CENTRO = LADO / 2;
/** Separación entre porciones, en grados. */
const SEPARACION = 2;

export function colorDeCategoria(categoria: string, indice: number): string {
  if (categoria === "Otros") return colorOtros;
  return paletaCategorias[indice % paletaCategorias.length];
}

/** Punto del círculo a `grados` desde arriba, avanzando como las agujas del reloj. */
function punto(grados: number): [number, number] {
  const radianes = ((grados - 90) * Math.PI) / 180;
  return [CENTRO + RADIO * Math.cos(radianes), CENTRO + RADIO * Math.sin(radianes)];
}

/** Arco entre dos ángulos, como trazo (el grosor lo da strokeWidth). */
function arco(desde: number, hasta: number): string {
  // Un arco de 360° no se puede dibujar de un trazo: inicio y fin coinciden.
  const fin = hasta - desde >= 360 ? desde + 359.99 : hasta;
  const [x1, y1] = punto(desde);
  const [x2, y2] = punto(fin);
  const mayor = fin - desde > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIO} ${RADIO} 0 ${mayor} 1 ${x2} ${y2}`;
}

export function GraficoCategorias({
  porciones,
  total,
}: {
  porciones: PorcionCategoria[];
  total: number;
}) {
  let anguloInicio = 0;
  const unaSola = porciones.length === 1;

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.lienzo}>
        <Svg width={LADO} height={LADO}>
          {porciones.map((p, i) => {
            const desde = anguloInicio;
            const hasta = desde + p.fraccion * 360;
            anguloInicio = hasta;
            return (
              <Path
                key={p.categoria}
                d={arco(desde, unaSola ? hasta : hasta - SEPARACION)}
                fill="none"
                stroke={colorDeCategoria(p.categoria, i)}
                strokeWidth={GROSOR}
              />
            );
          })}
        </Svg>

        <View style={estilos.centro} pointerEvents="none">
          <Text style={estilos.total}>{pesos(total)}</Text>
          <Text style={estilos.rotulo}>GASTADO</Text>
        </View>
      </View>

      <View style={estilos.leyenda}>
        {porciones.map((p, i) => (
          <View key={p.categoria} style={estilos.item}>
            <View style={[estilos.punto, { backgroundColor: colorDeCategoria(p.categoria, i) }]} />
            <Text style={estilos.nombre} numberOfLines={1}>{p.categoria}</Text>
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
  lienzo: { alignItems: "center", justifyContent: "center" },
  centro: { position: "absolute", alignItems: "center" },
  total: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 22, letterSpacing: -0.5 },
  rotulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 10, letterSpacing: 1.2 },
  leyenda: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: espacio.l,
    rowGap: espacio.m,
  },
  item: { width: "50%", flexDirection: "row", alignItems: "center", gap: espacio.s, paddingRight: espacio.s },
  punto: { width: 10, height: 10, borderRadius: 3 },
  nombre: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, flex: 1 },
  porcentaje: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 14 },
});
