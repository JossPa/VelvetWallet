/**
 * Barra de progreso que crece hasta su valor al entrar.
 *
 * Aparecía repetida en metas, en el detalle de una meta y en el desglose de una
 * categoría, cada vez con su propio `width` calculado a mano. Aquí queda una
 * sola, y con ella el movimiento: la barra se llena desde cero hasta donde
 * corresponde, igual que el anillo se traza y las barras de meses crecen.
 *
 * No es adorno. Una barra que aparece ya llena se lee como una imagen fija; una
 * que se llena se lee como una medición — y lo que estas barras miden es
 * justamente cuánto se avanzó.
 */
import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useMovimientoReducido } from "@/components/Movimiento";
import { colores, movimiento as tiempos } from "@/constants/tema";

type Props = {
  /** Cuánto se llena, de 0 a 1. Por encima de 1 se recorta: nadie avanza 120%. */
  fraccion: number;
  alto?: number;
  /** Retraso de entrada, para que una lista de barras se llene en cascada. */
  demora?: number;
  color?: string;
  style?: ViewStyle;
};

export function BarraAvance({
  fraccion,
  alto = 6,
  demora = 0,
  color = colores.acento,
  style,
}: Props) {
  const reducido = useMovimientoReducido();
  const tope = Math.min(Math.max(fraccion, 0), 1);
  const llenado = useSharedValue(0);

  useEffect(() => {
    llenado.value = reducido
      ? tope
      : withDelay(demora, withTiming(tope, { duration: tiempos.lento }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tope, reducido]);

  const animado = useAnimatedStyle(() => ({ width: `${llenado.value * 100}%` }));

  const curva = alto / 2;

  return (
    <View style={[estilos.pista, { height: alto, borderRadius: curva }, style]}>
      <Animated.View
        style={[{ height: "100%", backgroundColor: color, borderRadius: curva }, animado]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pista: { backgroundColor: colores.chip, overflow: "hidden" },
});
