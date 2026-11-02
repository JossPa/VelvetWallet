/**
 * Botón principal. Mientras `cargando` está activo se deshabilita y muestra un
 * indicador: sin eso, el usuario toca dos veces y se envían dos peticiones.
 */
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { Tocable } from "@/components/Movimiento";
import { colores, espacio, fuente, radio } from "@/constants/tema";

type Props = {
  titulo: string;
  onPress: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
  /** Variante secundaria: fondo neutro en vez del acento. */
  secundario?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Boton({ titulo, onPress, cargando, deshabilitado, secundario, style }: Props) {
  const inactivo = deshabilitado || cargando;

  return (
    // `disabled` también corta el encogido: deshabilitado no debe ceder al
    // dedo, porque eso diría que sí pasó algo.
    <Tocable
      onPress={onPress}
      disabled={inactivo}
      style={[estilos.boton, secundario && estilos.secundario, inactivo && estilos.inactivo, style]}
    >
      {cargando ? (
        <ActivityIndicator color={secundario ? colores.texto : "#FFFFFF"} />
      ) : (
        <Text style={[estilos.texto, secundario && estilos.textoSecundario]}>{titulo}</Text>
      )}
    </Tocable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    backgroundColor: colores.acento,
    borderRadius: radio.m,
    paddingVertical: espacio.l,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  // El secundario es una superficie, no un bloque de color: necesita su canto
  // igual que las tarjetas, o sobre el fondo oscuro se lee como una mancha.
  secundario: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.bordeVivo,
  },
  inactivo: { opacity: 0.5 },
  texto: { color: "#FFFFFF", fontFamily: fuente.textoFuerte, fontSize: 16 },
  textoSecundario: { color: colores.texto },
});
