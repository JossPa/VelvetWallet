/**
 * Anillo de gasto por categoría, con el total al centro.
 *
 * Cada porción es un arco dibujado por ángulos: se parte arriba (12 en punto)
 * y se avanza en el sentido del reloj según la fracción que ocupa cada una.
 *
 * **El anillo se dibuja solo al entrar**, en una sola pasada de las doce en
 * punto hacia la derecha, como si se estuviera trazando con tus datos. No es
 * adorno: un gráfico que aparece ya hecho se lee como una imagen; uno que se
 * traza se lee como un resultado. El truco es el trazo discontinuo —se le da
 * a cada arco un guión del largo exacto del arco y se corre su desfase de ese
 * largo hasta cero, así que el arco va apareciendo por su recorrido.
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Cifra } from "@/components/Cifra";
import { Tocable, useMovimientoReducido } from "@/components/Movimiento";
import { colores, espacio, fuente, movimiento as tiempos, radio } from "@/constants/tema";
import { usePaletaCategorias } from "@/utils/coloresCategoria";
import { type PorcionCategoria } from "@/utils/resumen";

const PathAnimado = Animated.createAnimatedComponent(Path);

const LADO = 180;
const GROSOR = 26;
const RADIO = (LADO - GROSOR) / 2;
const CENTRO = LADO / 2;
/** Separación entre porciones, en grados. */
const SEPARACION = 2;


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

/**
 * Un arco del anillo, que se traza cuando el barrido le llega.
 *
 * `avance` va de 0 a 1 por la vuelta completa. El arco mira qué parte de ese
 * recorrido le toca a él —de `desdeF` a `hastaF`— y traduce el avance global a
 * su propio avance local. Así el anillo se dibuja de corrido en vez de que
 * todas las porciones aparezcan a la vez, que es lo que se vería si cada una
 * animara por su cuenta.
 */
function Arco({
  d,
  color,
  largo,
  desdeF,
  hastaF,
  avance,
}: {
  d: string;
  color: string;
  largo: number;
  desdeF: number;
  hastaF: number;
  avance: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => {
    const tramo = hastaF - desdeF;
    const local = tramo <= 0 ? 1 : (avance.value - desdeF) / tramo;
    const k = Math.min(1, Math.max(0, local));
    return { strokeDashoffset: largo * (1 - k) };
  });

  return (
    <PathAnimado
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={GROSOR}
      strokeDasharray={[largo, largo]}
      animatedProps={props}
    />
  );
}

export function GraficoCategorias({
  porciones,
  total,
  onSeleccionar,
}: {
  porciones: PorcionCategoria[];
  total: number;
  /** Si se entrega, cada entrada de la leyenda abre el desglose de su categoría. */
  onSeleccionar?: (categoria: string) => void;
}) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);
  const unaSola = porciones.length === 1;
  // El color ya no sale de la posición en ESTE gráfico sino del ranking de
  // todo el historial, así que una categoría se ve igual en el anillo, en la
  // lista de movimientos y en el desglose. Ver utils/coloresCategoria.
  const paleta = usePaletaCategorias();

  useEffect(() => {
    avance.value = reducido ? 1 : withTiming(1, { duration: tiempos.lento });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducido]);

  // Dónde empieza y dónde termina cada porción dentro de la vuelta completa.
  let acumulado = 0;
  const arcos = porciones.map((p, i) => {
    const desdeF = acumulado;
    acumulado += p.fraccion;
    const desde = desdeF * 360;
    const hasta = acumulado * 360;
    const fin = unaSola ? hasta : hasta - SEPARACION;
    return {
      clave: p.categoria,
      d: arco(desde, fin),
      color: paleta.color(p.categoria),
      // Largo del trazo: el arco de una circunferencia es radio por el ángulo
      // en radianes. Es lo que hay que recorrer para dibujarlo entero.
      largo: Math.max(1, RADIO * ((Math.min(fin - desde, 359.99) * Math.PI) / 180)),
      desdeF,
      hastaF: acumulado,
    };
  });

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.lienzo}>
        <Svg width={LADO} height={LADO}>
          {arcos.map((a) => (
            <Arco
              key={a.clave}
              d={a.d}
              color={a.color}
              largo={a.largo}
              desdeF={a.desdeF}
              hastaF={a.hastaF}
              avance={avance}
            />
          ))}
        </Svg>

        <View style={estilos.centro} pointerEvents="none">
          <Cifra valor={total} style={estilos.total} />
          <Text style={estilos.rotulo}>GASTADO</Text>
        </View>
      </View>

      {/* La leyenda es la puerta al desglose: cada categoría se puede abrir
          para ver en qué comercios se fue. Sin `onSeleccionar` queda inerte,
          para no ofrecer un toque que no lleva a ninguna parte. */}
      <View style={estilos.leyenda}>
        {porciones.map((p) => {
          const contenido = (
            <>
              <View style={[estilos.punto, { backgroundColor: paleta.color(p.categoria) }]} />
              <Text style={estilos.nombre} numberOfLines={1}>{p.categoria}</Text>
              <Text style={estilos.porcentaje}>{Math.round(p.fraccion * 100)}%</Text>
              {onSeleccionar ? (
                <Ionicons name="chevron-forward" size={13} color={colores.texto3} />
              ) : null}
            </>
          );

          return onSeleccionar ? (
            <Tocable
              key={p.categoria}
              onPress={() => onSeleccionar(p.categoria)}
              style={estilos.item}
            >
              {contenido}
            </Tocable>
          ) : (
            <View key={p.categoria} style={estilos.item}>{contenido}</View>
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
