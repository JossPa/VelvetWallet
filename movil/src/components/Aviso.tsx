/**
 * Aviso destacado con barra de color a la izquierda.
 * Ámbar por defecto (algo requiere atención); se puede pasar otro tono.
 */
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";

type Props = {
  children: ReactNode;
  detalle?: string;
  onPress?: () => void;
};

export function Aviso({ children, detalle, onPress }: Props) {
  const Contenedor = onPress ? Pressable : View;
  return (
    <Contenedor onPress={onPress} style={estilos.caja}>
      <View style={estilos.barra} />
      <View style={estilos.textos}>
        <Text style={estilos.texto}>{children}</Text>
        {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      </View>
    </Contenedor>
  );
}

const estilos = StyleSheet.create({
  caja: {
    flexDirection: "row",
    backgroundColor: colores.alertaSuave,
    borderRadius: radio.m,
    padding: espacio.l,
    marginTop: espacio.l,
    gap: espacio.m,
  },
  barra: { width: 3, borderRadius: 2, backgroundColor: colores.alerta },
  textos: { flex: 1, gap: 2 },
  texto: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15 },
  detalle: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13 },
});
