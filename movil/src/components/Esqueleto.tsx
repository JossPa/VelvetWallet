/**
 * Esqueletos de carga: la forma de la pantalla antes de que lleguen los datos.
 *
 * **Por qué no es adorno.** Mientras la primera carga está en vuelo, la app no
 * sabe si la persona tiene movimientos o no. Si en ese hueco se muestra
 * "Conecta tu primer banco", se le está afirmando algo falso a alguien que sí
 * tiene su banco conectado — y la pantalla salta sola un segundo después, que
 * es el peor momento para que algo cambie de lugar. El esqueleto dice lo único
 * que es cierto en ese instante: "aquí va a haber algo, ya casi".
 *
 * Por eso además reserva **el mismo alto** que el contenido real: cuando los
 * datos llegan, ocupan el lugar que ya estaba hecho y nada se corre.
 *
 * El pulso es leve y en una sola propiedad (opacidad). Un brillo que recorre
 * la pantalla llama la atención hacia la espera, que es exactamente lo que no
 * se quiere mirar.
 */
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useMovimientoReducido } from "@/components/Movimiento";
import { colores, espacio, movimiento as tiempos, radio } from "@/constants/tema";

const OPACIDAD_BAJA = 0.4;
const OPACIDAD_ALTA = 1;

/** Bloque gris que late. Es la pieza con la que se arman todos los esqueletos. */
export function Bloque({
  ancho = "100%",
  alto = 14,
  curva = radio.s,
  style,
}: {
  ancho?: DimensionValue;
  alto?: number;
  curva?: number;
  style?: ViewStyle;
}) {
  const reducido = useMovimientoReducido();
  const pulso = useSharedValue(OPACIDAD_BAJA);

  useEffect(() => {
    pulso.value = reducido
      ? OPACIDAD_BAJA
      : withRepeat(withTiming(OPACIDAD_ALTA, { duration: tiempos.lento }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducido]);

  const animado = useAnimatedStyle(() => ({ opacity: pulso.value }));

  return (
    <Animated.View
      style={[
        { width: ancho, height: alto, borderRadius: curva, backgroundColor: colores.chip },
        animado,
        style,
      ]}
    />
  );
}

/** Tarjeta vacía del alto de una tarjeta de verdad, con bloques dentro. */
export function TarjetaEsqueleto({ children, style }: { children?: ReactNode; style?: ViewStyle }) {
  return <View style={[estilos.tarjeta, style]}>{children}</View>;
}

/**
 * Esqueleto del panel de inicio.
 *
 * Reproduce el orden de la pantalla real —rótulo, cifra grande, botón, el par
 * de tarjetas, un gráfico— para que al llegar los datos la lectura siga en el
 * mismo sitio donde la persona ya había puesto el ojo.
 */
export function EsqueletoInicio() {
  return (
    <View style={estilos.raiz}>
      <Bloque ancho={160} alto={12} />
      <Bloque ancho={220} alto={46} curva={radio.m} style={estilos.cifra} />
      <Bloque alto={46} curva={radio.m} style={estilos.boton} />

      <View style={estilos.par}>
        <TarjetaEsqueleto style={estilos.mitad}>
          <Bloque ancho={70} alto={10} />
          <Bloque ancho={120} alto={22} style={estilos.enTarjeta} />
        </TarjetaEsqueleto>
        <TarjetaEsqueleto style={estilos.mitad}>
          <Bloque ancho={60} alto={10} />
          <Bloque ancho={110} alto={22} style={estilos.enTarjeta} />
        </TarjetaEsqueleto>
      </View>

      <TarjetaEsqueleto style={estilos.grafico}>
        <Bloque ancho={140} alto={26} curva={radio.s} />
        <Bloque alto={14} curva={7} style={estilos.barra} />
        <View style={estilos.leyenda}>
          <Bloque alto={12} />
          <Bloque ancho="70%" alto={12} />
          <Bloque ancho="85%" alto={12} />
        </View>
      </TarjetaEsqueleto>
    </View>
  );
}

/** Esqueleto de una lista de movimientos: tantas filas como quepan sin mentir. */
export function EsqueletoLista({ filas = 6 }: { filas?: number }) {
  return (
    <View style={estilos.lista}>
      {Array.from({ length: filas }, (_, i) => (
        <View key={i} style={estilos.fila}>
          <Bloque ancho={34} alto={34} curva={radio.s} />
          <View style={estilos.filaTexto}>
            {/* Anchos distintos por fila: una columna de bloques idénticos se
                lee como una tabla, no como una lista de nombres. */}
            <Bloque ancho={`${62 - (i % 3) * 12}%`} alto={13} />
            <Bloque ancho={`${34 - (i % 2) * 8}%`} alto={10} />
          </View>
          <Bloque ancho={74} alto={14} />
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { paddingTop: espacio.s },
  cifra: { marginTop: espacio.s },
  boton: { marginTop: espacio.l },
  par: { flexDirection: "row", gap: espacio.m, marginTop: espacio.l },
  mitad: { flex: 1 },
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.l,
    padding: espacio.l,
  },
  enTarjeta: { marginTop: espacio.m },
  grafico: { marginTop: espacio.l },
  barra: { marginTop: espacio.l },
  leyenda: { marginTop: espacio.l, gap: espacio.m },
  lista: { gap: espacio.l, marginTop: espacio.m },
  fila: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  filaTexto: { flex: 1, gap: espacio.s },
});
