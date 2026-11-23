/**
 * Velvi con vida: la mascota del asistente, animada según lo que está haciendo.
 *
 * La regla de la app sigue valiendo —el movimiento confirma, no entretiene—,
 * así que cada movimiento dice algo:
 *
 *   flota suave        está esperando tu pregunta
 *   ladea la cabeza    estás escribiendo: te está escuchando
 *   se balancea rápido está leyendo tus datos
 *   da un saltito      llegó la respuesta
 *   se queda quieto    no tiene el dato y se abstiene (orejas caídas)
 *
 * Además parpadea cada pocos segundos, a intervalos irregulares: es lo que hace
 * que se sienta presente y no como un dibujo pegado.
 *
 * Con "reducir movimiento" activado en el sistema no flota, no se balancea ni
 * salta: queda quieto y solo parpadea, que no desplaza nada en pantalla.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Mascota, type EstadoMascota } from "@/components/Mascota";
import { useMovimientoReducido } from "@/components/Movimiento";
import { colores } from "@/constants/tema";

const suave = Easing.inOut(Easing.sin);

export function VelviVivo({
  estado = "escuchando",
  tamano = 40,
  atento = false,
  reaccion = 0,
  conHalo = false,
}: {
  estado?: EstadoMascota;
  tamano?: number;
  /** La persona está escribiendo: ladea la cabeza hacia el texto. */
  atento?: boolean;
  /** Sube en uno cada vez que llega una respuesta: dispara el saltito. */
  reaccion?: number;
  /** Halo rojo que respira detrás, para cuando Velvi está grande y solo. */
  conHalo?: boolean;
}) {
  const reducido = useMovimientoReducido();
  const flota = useSharedValue(0);  // 0 → 1 → 0: abajo, arriba, abajo
  const giro = useSharedValue(0);   // grados
  const salto = useSharedValue(0);  // píxeles hacia arriba
  const [parpadeo, setParpadeo] = useState(false);

  // Flotar y balancearse según el estado
  useEffect(() => {
    cancelAnimation(flota);
    cancelAnimation(giro);
    if (reducido) {
      flota.value = withTiming(0, { duration: 200 });
      giro.value = withTiming(0, { duration: 200 });
      return;
    }
    if (estado === "consultando") {
      flota.value = withRepeat(withSequence(
        withTiming(1, { duration: 420, easing: suave }),
        withTiming(0, { duration: 420, easing: suave }),
      ), -1);
      giro.value = withRepeat(withSequence(
        withTiming(-5, { duration: 520, easing: suave }),
        withTiming(5, { duration: 520, easing: suave }),
      ), -1, true);
    } else if (estado === "no_sabe") {
      flota.value = withTiming(0, { duration: 500, easing: suave });
      giro.value = withTiming(-7, { duration: 500, easing: suave });
    } else {
      flota.value = withRepeat(withSequence(
        withTiming(1, { duration: 1700, easing: suave }),
        withTiming(0, { duration: 1700, easing: suave }),
      ), -1);
      giro.value = withSpring(atento ? 8 : 0, { damping: 12, stiffness: 120 });
    }
  }, [estado, atento, reducido, flota, giro]);

  // Saltito cuando llega una respuesta
  useEffect(() => {
    if (reaccion === 0 || reducido) return;
    salto.value = withSequence(
      withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 7, stiffness: 180 }),
    );
  }, [reaccion, reducido, salto]);

  // Parpadeo a intervalos irregulares, como un ser vivo
  useEffect(() => {
    if (estado === "no_sabe") return;
    let espera: ReturnType<typeof setTimeout>;
    let abre: ReturnType<typeof setTimeout>;
    const programar = () => {
      espera = setTimeout(() => {
        setParpadeo(true);
        abre = setTimeout(() => {
          setParpadeo(false);
          programar();
        }, 140);
      }, 2200 + Math.random() * 3200);
    };
    programar();
    return () => {
      clearTimeout(espera);
      clearTimeout(abre);
      setParpadeo(false);
    };
  }, [estado]);

  const amplitud = tamano * 0.05;
  const cuerpo = useAnimatedStyle(() => ({
    transform: [
      { translateY: -flota.value * amplitud - salto.value * tamano * 0.12 },
      { rotate: `${giro.value}deg` },
      { scale: 1 + salto.value * 0.06 },
    ],
  }));
  // La sombra se achica cuando Velvi sube: así se lee que está en el aire.
  const sombra = useAnimatedStyle(() => ({
    opacity: interpolate(flota.value + salto.value, [0, 1], [0.45, 0.22]),
    transform: [{ scaleX: interpolate(flota.value + salto.value, [0, 1], [1, 0.78]) }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(flota.value, [0, 1], [0.16, 0.3]),
    transform: [{ scale: interpolate(flota.value, [0, 1], [0.94, 1.04]) }],
  }));

  return (
    <View style={{ width: tamano, height: tamano * (conHalo ? 1.12 : 1), alignItems: "center" }}>
      {conHalo ? (
        <Animated.View
          pointerEvents="none"
          style={[estilos.halo, { width: tamano * 1.05, height: tamano * 1.05, borderRadius: tamano }, halo]}
        />
      ) : null}
      {conHalo ? (
        <Animated.View
          pointerEvents="none"
          style={[estilos.sombra, { width: tamano * 0.55, height: tamano * 0.07, top: tamano * 1.03 }, sombra]}
        />
      ) : null}
      <Animated.View style={cuerpo}>
        <Mascota estado={estado} tamano={tamano} parpadeo={parpadeo} />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  halo: {
    position: "absolute",
    top: 0,
    backgroundColor: colores.acento,
    // en la web el desenfoque suaviza el borde del halo; en el teléfono queda como un disco tenue
    ...({ filter: "blur(18px)" } as object),
  },
  sombra: { position: "absolute", borderRadius: 999, backgroundColor: "#000000" },
});
