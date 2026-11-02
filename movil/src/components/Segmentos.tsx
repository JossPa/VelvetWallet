/**
 * Selector de segmentos: una fila de opciones donde solo una está activa.
 * Genérico sobre el tipo de valor, para usarlo con cualquier conjunto fijo.
 *
 * **La píldora se desliza.** Antes el fondo del segmento activo saltaba de un
 * lugar a otro, y eso se lee como que la pantalla se redibujó. Deslizándola, se
 * lee como que la selección se movió — que es lo que de verdad pasó. Es de los
 * cambios más baratos que existen y se siente en cada toque.
 *
 * **El radio es concéntrico.** La píldora usa el radio del contenedor menos el
 * hueco que los separa (12 − 4 = 8). Tenía 10, y un interior más redondo que su
 * marco es justo lo que el ojo registra como "no calza" sin poder explicarlo.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Tocable, useMovimientoReducido } from "@/components/Movimiento";
import { colores, espacio, fuente, movimiento as tiempos, radio, radioInterior } from "@/constants/tema";

const HUECO = 4;
const CURVA = radioInterior(radio.m, HUECO);

type Opcion<T extends string> = { valor: T; etiqueta: string };

type Props<T extends string> = {
  opciones: Opcion<T>[];
  valor: T;
  onCambio: (valor: T) => void;
};

export function Segmentos<T extends string>({ opciones, valor, onCambio }: Props<T>) {
  const reducido = useMovimientoReducido();
  // El ancho se mide en vez de calcularse: así la píldora calza exacto sea
  // cual sea el ancho de la pantalla y cuántas opciones haya.
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor));
  const paso = ancho > 0 ? (ancho - HUECO * 2) / opciones.length : 0;

  const x = useSharedValue(0);

  useEffect(() => {
    const destino = indice * paso;
    // En la primera medición se coloca sin animar: si no, la píldora entraría
    // volando desde la izquierda cada vez que se monta la pantalla.
    x.value =
      reducido || x.value === 0
        ? destino
        : withTiming(destino, { duration: tiempos.normal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, paso, reducido]);

  const pildora = useAnimatedStyle(() => ({
    width: paso,
    transform: [{ translateX: x.value }],
  }));

  function medir(e: LayoutChangeEvent) {
    setAncho(e.nativeEvent.layout.width);
  }

  return (
    <View style={estilos.contenedor} onLayout={medir}>
      {paso > 0 ? <Animated.View style={[estilos.pildora, pildora]} pointerEvents="none" /> : null}

      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Tocable key={o.valor} onPress={() => onCambio(o.valor)} style={estilos.segmento}>
            <Text style={[estilos.texto, activa && estilos.textoActivo]}>{o.etiqueta}</Text>
          </Tocable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.m,
    padding: HUECO,
    marginBottom: espacio.l,
  },
  pildora: {
    position: "absolute",
    top: HUECO,
    left: HUECO,
    bottom: HUECO,
    backgroundColor: colores.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.bordeVivo,
    borderRadius: CURVA,
  },
  segmento: {
    flex: 1,
    paddingVertical: espacio.s + 2,
    borderRadius: CURVA,
    alignItems: "center",
  },
  texto: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 15 },
  textoActivo: { color: colores.texto, fontFamily: fuente.textoFuerte },
});
