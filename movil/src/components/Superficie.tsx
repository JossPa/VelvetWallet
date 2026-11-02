/**
 * Las superficies de la app, con luz.
 *
 * **El problema que resuelve.** La app tenía UNA sola clase de tarjeta: mismo
 * color, mismo radio, mismo relleno, repetida doce veces en Inicio. Cuando todo
 * pesa lo mismo, nada destaca, y la pantalla se lee como una pila de
 * rectángulos en vez de como información ordenada.
 *
 * Aquí hay **tres niveles**, y el nivel dice qué contiene a qué:
 *
 *   1 · zona     — la superficie grande que CONTIENE a otras (el héroe)
 *   2 · tarjeta  — una tarjeta común sobre el fondo
 *   3 · anidada  — un bloque dentro de una tarjeta
 *
 * **La luz.** Cada superficie lleva dos cosas que juntas fingen una fuente de
 * luz cenital: un degradado interno de 3–4% que se apaga antes de la mitad, y
 * un borde superior más claro que los otros tres. Por separado son invisibles;
 * juntos son la diferencia entre "oscuro" y "oscuro bien hecho". La regla es
 * que no se note: si distingues dónde empieza el degradado, está muy fuerte.
 *
 * El degradado va en SVG y no en vistas apiladas semitransparentes porque
 * `react-native-svg` ya es dependencia y una sola capa rinde mejor que cuatro.
 */
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colores, luz, radio as radios } from "@/constants/tema";

export type Nivel = 1 | 2 | 3;

const FONDO: Record<Nivel, string> = {
  1: colores.zona,
  2: colores.tarjeta,
  3: colores.tarjetaAlta,
};

const INTENSIDAD: Record<Nivel, number> = {
  1: luz.zona,
  2: luz.tarjeta,
  3: luz.tarjeta,
};

/**
 * Curva de cada nivel.
 *
 * No son tres números sueltos: están elegidos para que al anidarlos las curvas
 * queden concéntricas, o sea que el interior valga el exterior menos el hueco
 * que los separa. Con los rellenos que se usan —12 dentro de una zona, 12
 * dentro de una tarjeta— la cadena cierra: 28 − 12 = 16, y 16 − 12 ≈ 12.
 * Cambiar uno de estos valores sin mirar el relleno de quien lo usa rompe esa
 * relación, que es justo lo que el ojo lee como "no calza". Ver `radioInterior`.
 */
const CURVA: Record<Nivel, number> = {
  1: radios.xl,
  2: radios.l,
  3: radios.m,
};

type Props = {
  nivel?: Nivel;
  /** Radio propio, si la superficie no usa el de su nivel. */
  curva?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Capa de luz sola, para superficies que ya existen con su propio estilo y
 * solo necesitan el degradado. Se posiciona absoluta y no intercepta toques.
 */
export function Luz({ nivel = 2, curva }: { nivel?: Nivel; curva?: number }) {
  const c = curva ?? CURVA[nivel];
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: c, overflow: "hidden" }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`luz${nivel}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={INTENSIDAD[nivel]} />
            <Stop offset={luz.alcance} stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#luz${nivel})`} />
      </Svg>
    </View>
  );
}

export function Superficie({ nivel = 2, curva, style, children }: Props) {
  const c = curva ?? CURVA[nivel];

  return (
    <View
      style={[
        {
          backgroundColor: FONDO[nivel],
          borderRadius: c,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colores.borde,
          borderTopColor: colores.bordeAlto,
        },
        // La zona de nivel 1 proyecta sombra: es lo que la separa del fondo y
        // dice que está por encima de todo lo demás. Las tarjetas no, o la
        // pantalla se llena de halos.
        nivel === 1 && estilos.sombra,
        style,
      ]}
    >
      <Luz nivel={nivel} curva={c} />
      {children}
    </View>
  );
}

/**
 * Degradado de fondo de pantalla.
 *
 * El fondo deja de ser un color plano: se aclara hacia arriba, donde está la
 * cifra principal, con un rastro de acento tan leve que no se ve como color
 * sino como que ahí hay algo. Es lo que hace que el contenido se sienta
 * iluminado en vez de pegado sobre una lámina negra.
 */
export function FondoDePantalla() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="fondoVelvet" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.035} />
            <Stop offset="0.34" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="fondoAcento" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colores.acento} stopOpacity={0.07} />
            <Stop offset="0.22" stopColor={colores.acento} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fondoVelvet)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fondoAcento)" />
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
  sombra: {
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
});
