/**
 * Las piezas de movimiento que se repiten en toda la app.
 *
 * La regla de la que salen todas: **el movimiento confirma, no entretiene.**
 * Una tarjeta que entra desde abajo dice "esto se acaba de armar"; algo que se
 * encoge bajo el dedo dice "te escuché". Nada se mueve por adorno.
 *
 * `Aparecer` — entra desde abajo con un desvanecido corto. Encadenado con
 * `demora` creciente da la entrada escalonada que hace que una pantalla se lea
 * de arriba hacia abajo en vez de aparecer de golpe.
 *
 * `Tocable` — un `Pressable` que se encoge al presionarse. La app venía usando
 * `opacity: 0.7`, que es lo que sale por defecto y se nota: bajar la opacidad
 * hace que el elemento parezca desactivado, mientras que encogerlo un 2% se
 * lee como que cedió bajo el dedo.
 *
 * Ambas respetan "reducir movimiento" del sistema: con esa opción activada,
 * `Aparecer` entrega el contenido puesto y `Tocable` vuelve al desvanecido,
 * que no desplaza nada en pantalla. No es decoración de accesibilidad: para
 * alguien con sensibilidad vestibular, una interfaz que salta es un problema
 * real.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { movimiento as tiempos } from "@/constants/tema";

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/** Cuánto sube el contenido al entrar, en píxeles. */
const RECORRIDO = 14;
/** A cuánto se encoge lo que se presiona. */
const ENCOGIDO = 0.975;

/**
 * Si el sistema pidió reducir el movimiento.
 *
 * Se consulta al montar y se queda escuchando: la persona puede cambiar la
 * opción con la app abierta.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (vivo) setReducido(v); })
      .catch(() => { /* si no se puede consultar, se anima: es el caso normal */ });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducido);
    return () => {
      vivo = false;
      sub?.remove();
    };
  }, []);

  return reducido;
}

export function Aparecer({
  demora = 0,
  style,
  children,
}: {
  demora?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);

  // Solo al montar. Volver a animar porque cambió un dato haría que la
  // pantalla parpadee con cada sincronización.
  useEffect(() => {
    avance.value = reducido ? 1 : withDelay(demora, withTiming(1, { duration: tiempos.normal }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducido]);

  const animado = useAnimatedStyle(() => ({
    opacity: avance.value,
    transform: [{ translateY: (1 - avance.value) * RECORRIDO }],
  }));

  return <Animated.View style={[style, animado]}>{children}</Animated.View>;
}

/**
 * Golpecito al presionar, en el celular.
 *
 * Es la mitad que falta del encogido: la vista dice "te escuché" y el dedo lo
 * confirma. En web no existe y la llamada falla sin ruido, así que se corta
 * antes. Nunca se deja reventar: una háptica que no se puede dar no es motivo
 * para que un botón no funcione.
 */
function golpecito() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

type TocableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** Apaga la háptica donde el toque no es una decisión (filas de solo lectura). */
  sinHaptica?: boolean;
  children: ReactNode;
};

export function Tocable({ style, children, sinHaptica, disabled, ...resto }: TocableProps) {
  const reducido = useMovimientoReducido();
  const presion = useSharedValue(0);

  const animado = useAnimatedStyle(() =>
    reducido
      ? { opacity: 1 - presion.value * 0.3 }
      : { transform: [{ scale: 1 - presion.value * (1 - ENCOGIDO) }] },
  );

  return (
    <PressableAnimado
      disabled={disabled}
      onPressIn={() => {
        presion.value = withTiming(1, { duration: tiempos.rapido });
        if (!sinHaptica && !disabled) golpecito();
      }}
      onPressOut={() => { presion.value = withTiming(0, { duration: tiempos.rapido }); }}
      style={[style, animado]}
      {...resto}
    >
      {children}
    </PressableAnimado>
  );
}
