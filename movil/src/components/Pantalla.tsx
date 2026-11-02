/**
 * Marco común de toda pantalla y piezas de layout que se repiten.
 *
 * `SafeAreaView` evita que el contenido quede debajo de la muesca o la barra
 * de estado del teléfono. `etiqueta` es el chip de la derecha del mockup
 * ("Agosto", "3 conectadas", "1 activa").
 *
 * **La cabecera colapsa al hacer scroll.** El título grande se desvanece y, en
 * su lugar, baja una barra con el nombre de la pantalla y —si se entrega
 * `resumen`— la cifra principal. El motivo no es adorno: hoy el título es texto
 * estático que se va con el scroll, así que apenas bajas un poco te quedas sin
 * saber cuánto tienes y sin saber dónde estás. El contenido pasa desenfocado
 * por detrás de la barra en vez de cortarse contra un borde duro.
 *
 * El fondo ya no es un color plano: `FondoDePantalla` lo aclara hacia arriba,
 * donde vive la cifra principal.
 */
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Tocable, useMovimientoReducido } from "@/components/Movimiento";
import { FondoDePantalla } from "@/components/Superficie";
import { colores, espacio, fuente, radio } from "@/constants/tema";

/** Dónde empieza y dónde termina el relevo entre el título y la barra. */
const DESDE = 16;
const HASTA = 64;
const ALTO_BARRA = 52;

/** La cifra que la barra muestra cuando el título ya salió de pantalla. */
export type ResumenDeBarra = {
  rotulo: string;
  valor: string;
  /** La pinta con el acento: un disponible en rojo sigue siendo rojo arriba. */
  negativo?: boolean;
};

type Props = {
  titulo: string;
  /** Chip de texto a la derecha del título. */
  etiqueta?: string;
  /** Control a la derecha del título (reemplaza al chip), p. ej. el selector de mes. */
  accesorio?: ReactNode;
  /** Si se entrega, muestra la flecha de volver a la izquierda del título. */
  onAtras?: () => void;
  /** Cabecera de marca (cuadrado rojo + nombre en mayúsculas) en vez del título grande. Solo Inicio. */
  marca?: boolean;
  /** Cifra que viaja a la barra superior al hacer scroll. */
  resumen?: ResumenDeBarra;
  children?: ReactNode;
};

export function Pantalla({
  titulo,
  etiqueta,
  accesorio,
  onAtras,
  marca,
  resumen,
  children,
}: Props) {
  const reducido = useMovimientoReducido();
  const y = useSharedValue(0);

  const alScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });

  // La barra aparece justo cuando el título se va. El relevo es el punto:
  // nunca se ven los dos a la vez ni se queda la pantalla sin encabezado.
  const barra = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [DESDE, HASTA], [0, 1], Extrapolation.CLAMP),
  }));

  const cabecera = useAnimatedStyle(() => {
    const t = interpolate(y.value, [DESDE, HASTA], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: t,
      // Con "reducir movimiento" solo se desvanece: nada se desplaza.
      transform: reducido ? [] : [{ translateY: (1 - t) * -10 }],
    };
  });

  return (
    <SafeAreaView style={estilos.area} edges={["top"]}>
      <FondoDePantalla />

      <Animated.ScrollView
        contentContainerStyle={estilos.contenido}
        onScroll={alScroll}
        scrollEventThrottle={16}
      >
        <Animated.View style={[estilos.cabecera, cabecera]}>
          <View style={estilos.tituloConAtras}>
            {onAtras ? (
              <Pressable onPress={onAtras} hitSlop={12} style={estilos.atras}>
                <Ionicons name="chevron-back" size={26} color={colores.texto} />
              </Pressable>
            ) : null}
            {marca ? <View style={estilos.marcaCuadro} /> : null}
            <Text style={marca ? estilos.marcaTexto : estilos.titulo}>
              {marca ? titulo.toUpperCase() : titulo}
            </Text>
          </View>
          {accesorio ??
            (etiqueta ? (
              <View style={estilos.chip}>
                <Text style={estilos.chipTexto}>{etiqueta}</Text>
              </View>
            ) : null)}
        </Animated.View>
        {children}
      </Animated.ScrollView>

      {/* Va después del scroll para quedar por encima, y con `pointerEvents`
          en "box-none" para que solo la flecha de volver reciba toques: el
          resto de la barra deja pasar el scroll que ocurre debajo. */}
      <Animated.View style={[estilos.barra, barra]} pointerEvents="box-none">
        <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={estilos.barraVelo} pointerEvents="none" />
        <View style={estilos.barraFila} pointerEvents="box-none">
          {onAtras ? (
            <Tocable onPress={onAtras} hitSlop={12} style={estilos.barraAtras}>
              <Ionicons name="chevron-back" size={22} color={colores.texto} />
            </Tocable>
          ) : marca ? (
            <View style={estilos.barraMarca} />
          ) : null}

          <Text style={estilos.barraTitulo} numberOfLines={1}>
            {resumen ? resumen.rotulo : titulo}
          </Text>

          {resumen ? (
            <Text style={[estilos.barraValor, resumen.negativo && estilos.barraValorRojo]}>
              {resumen.valor}
            </Text>
          ) : etiqueta ? (
            <Text style={estilos.barraEtiqueta}>{etiqueta}</Text>
          ) : null}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

/** Rótulo de sección en mayúsculas espaciadas: "TUS DATOS", "CORREGIR". */
export function Seccion({ titulo }: { titulo: string }) {
  return <Text style={estilos.seccion}>{titulo.toUpperCase()}</Text>;
}

/** Tarjeta gris de texto informativo, como la nota de confianza al pie de Cuentas. */
export function Nota({ children }: { children: ReactNode }) {
  return (
    <View style={estilos.nota}>
      <Text style={estilos.notaTexto}>{children}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, backgroundColor: colores.fondo },
  // La barra de pestañas ahora flota sobre el contenido (va con desenfoque),
  // así que el scroll tiene que terminar por debajo de ella: 68 de alto más
  // aire, o la última fila queda tapada.
  contenido: { padding: espacio.l, paddingBottom: 68 + espacio.xl },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: espacio.xl,
  },
  tituloConAtras: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  marcaCuadro: { width: 22, height: 22, borderRadius: 6, backgroundColor: colores.acento, marginRight: espacio.m },
  marcaTexto: { color: colores.texto2, fontFamily: fuente.tituloMedio, fontSize: 15, letterSpacing: 2 },
  atras: { marginLeft: -espacio.s, marginRight: espacio.xs },
  titulo: {
    color: colores.texto,
    fontFamily: fuente.titulo,
    fontSize: 30,
    letterSpacing: -0.6,
  },
  chip: {
    backgroundColor: colores.chip,
    paddingHorizontal: espacio.m,
    paddingVertical: 6,
    borderRadius: radio.l,
  },
  chipTexto: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 13 },

  // ── barra superior que releva al título ──
  barra: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ALTO_BARRA,
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  /**
   * Velo bajo el desenfoque. El desenfoque solo difumina lo que pasa por
   * detrás; sin un velo, texto claro sobre texto claro sigue siendo ilegible.
   * En web `expo-blur` cae a un fondo sólido, así que el velo queda igual.
   */
  barraVelo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Platform.OS === "web" ? "rgba(13,13,16,0.82)" : "rgba(13,13,16,0.55)",
  },
  barraFila: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    paddingHorizontal: espacio.l,
  },
  barraAtras: { marginLeft: -espacio.s },
  barraMarca: { width: 18, height: 18, borderRadius: 5, backgroundColor: colores.acento },
  barraTitulo: {
    flex: 1,
    color: colores.texto2,
    fontFamily: fuente.tituloMedio,
    fontSize: 13.5,
    letterSpacing: 1.1,
  },
  barraValor: {
    color: colores.texto,
    fontFamily: fuente.titulo,
    fontSize: 17,
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  barraValorRojo: { color: colores.acento },
  barraEtiqueta: { color: colores.texto3, fontFamily: fuente.textoMedio, fontSize: 13 },

  seccion: {
    color: colores.texto3,
    fontFamily: fuente.tituloMedio,
    fontSize: 12,
    letterSpacing: 1.2,
    marginTop: espacio.xl,
    marginBottom: espacio.s,
  },
  nota: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.m,
    padding: espacio.l,
    marginTop: espacio.l,
  },
  notaTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 21 },
});
