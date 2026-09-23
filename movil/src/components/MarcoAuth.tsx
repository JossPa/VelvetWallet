/**
 * Marco de las pantallas sin sesión: marca arriba, título, contenido y pie.
 *
 * KeyboardAvoidingView evita que el teclado del teléfono tape el campo que se
 * está escribiendo, que es lo que pasa en los formularios largos.
 */
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colores, espacio, fuente } from "@/constants/tema";

type Props = {
  titulo: string;
  bajada: string;
  children: ReactNode;
  pie?: ReactNode;
};

export function MarcoAuth({ titulo, bajada, children, pie }: Props) {
  return (
    <SafeAreaView style={estilos.area} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={estilos.flexible}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={estilos.contenido}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={estilos.marca}>
            <View style={estilos.marcaCuadro} />
            <Text style={estilos.marcaTexto}>VELVET WALLET</Text>
          </View>

          <Text style={estilos.titulo}>{titulo}</Text>
          <Text style={estilos.bajada}>{bajada}</Text>

          <View style={estilos.cuerpo}>{children}</View>

          {pie ? <View style={estilos.pie}>{pie}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, backgroundColor: colores.fondo },
  flexible: { flex: 1 },
  contenido: { flexGrow: 1, padding: espacio.xl, paddingTop: espacio.xl * 2 },
  marca: { flexDirection: "row", alignItems: "center", marginBottom: espacio.xl * 2 },
  marcaCuadro: { width: 22, height: 22, borderRadius: 6, backgroundColor: colores.acento, marginRight: espacio.m },
  marcaTexto: { color: colores.texto2, fontFamily: fuente.tituloMedio, fontSize: 15, letterSpacing: 2 },
  titulo: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 32, letterSpacing: -0.8 },
  bajada: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15, marginTop: espacio.s, lineHeight: 22 },
  cuerpo: { marginTop: espacio.xl, gap: espacio.l },
  pie: { marginTop: "auto", paddingTop: espacio.xl, alignItems: "center" },
});
