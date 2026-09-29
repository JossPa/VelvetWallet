/**
 * Inicio de sesión (RF-33).
 */
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { MarcoAuth } from "@/components/MarcoAuth";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { useSesion } from "@/sesion/SesionContexto";
import { ErrorAuth, emailValido } from "@/servicios/auth";

export default function IniciarSesion() {
  const { entrar } = useSesion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const completo = emailValido(email) && password.length > 0;

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await entrar({ email, password });
      // No se navega: el layout raíz detecta la sesión y entra solo.
    } catch (e) {
      setError(e instanceof ErrorAuth ? e.message : "No se pudo conectar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAuth
      titulo="Hola de nuevo"
      bajada="Entra para ver en qué se te va la plata este mes."
      pie={
        <Text style={estilos.pieTexto}>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" style={estilos.enlace}>
            Crear una
          </Link>
        </Text>
      }
    >
      <Campo
        etiqueta="Correo"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@correo.cl"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <Campo
        etiqueta="Contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="Tu contraseña"
        secreto
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => completo && enviar()}
        returnKeyType="go"
      />

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Boton titulo="Entrar" onPress={enviar} cargando={enviando} deshabilitado={!completo} />

      <View style={estilos.demo}>
        <Text style={estilos.demoTitulo}>Cuenta de prueba</Text>
        <Text style={estilos.demoTexto}>demo@velvetwallet.cl · velvet2026</Text>
      </View>
    </MarcoAuth>
  );
}

const estilos = StyleSheet.create({
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, textAlign: "center" },
  pieTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15 },
  enlace: { color: colores.acento, fontFamily: fuente.textoFuerte },
  demo: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    padding: espacio.m,
    alignItems: "center",
    gap: 2,
  },
  demoTitulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 11, letterSpacing: 1 },
  demoTexto: { color: colores.texto2, fontFamily: fuente.mono, fontSize: 13 },
});
