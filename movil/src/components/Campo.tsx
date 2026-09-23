/**
 * Campo de texto con etiqueta y mensaje de error.
 *
 * Las contraseñas traen el ojo para mostrar u ocultar: escribir una clave a
 * ciegas en un teclado de teléfono es la causa número uno de intentos fallidos.
 */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";

type Props = TextInputProps & {
  etiqueta: string;
  error?: string | null;
  /** Campo de contraseña: oculta el texto y muestra el botón de ver. */
  secreto?: boolean;
};

export function Campo({ etiqueta, error, secreto, style, ...resto }: Props) {
  const [visible, setVisible] = useState(false);
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={estilos.grupo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={[estilos.caja, enfocado && estilos.cajaEnfocada, error && estilos.cajaError]}>
        <TextInput
          style={[estilos.entrada, style]}
          placeholderTextColor={colores.texto3}
          secureTextEntry={secreto && !visible}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          {...resto}
        />
        {secreto ? (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} style={estilos.ojo}>
            <Ionicons name={visible ? "eye-off" : "eye"} size={20} color={colores.texto3} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={estilos.error}>{error}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacio.s },
  etiqueta: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 14 },
  caja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.linea,
    paddingHorizontal: espacio.l,
  },
  cajaEnfocada: { borderColor: colores.texto3 },
  cajaError: { borderColor: colores.acento },
  entrada: {
    flex: 1,
    color: colores.texto,
    fontFamily: fuente.texto,
    fontSize: 16,
    paddingVertical: espacio.l,
    // Quita el recuadro azul que el navegador dibuja al enfocar
    outlineStyle: "none",
  },
  ojo: { padding: espacio.xs },
  error: { color: colores.acento, fontFamily: fuente.texto, fontSize: 13 },
});
