/**
 * Botón principal. Mientras `cargando` está activo se deshabilita y muestra un
 * indicador: sin eso, el usuario toca dos veces y se envían dos peticiones.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

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
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        estilos.boton,
        secundario && estilos.secundario,
        inactivo && estilos.inactivo,
        pressed && !inactivo && estilos.presionado,
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={secundario ? colores.texto : "#FFFFFF"} />
      ) : (
        <Text style={[estilos.texto, secundario && estilos.textoSecundario]}>{titulo}</Text>
      )}
    </Pressable>
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
  secundario: { backgroundColor: colores.tarjeta },
  inactivo: { opacity: 0.5 },
  presionado: { opacity: 0.85 },
  texto: { color: "#FFFFFF", fontFamily: fuente.textoFuerte, fontSize: 16 },
  textoSecundario: { color: colores.texto },
});
