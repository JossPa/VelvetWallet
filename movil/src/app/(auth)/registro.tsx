/**
 * Registro de usuario (RF-33).
 *
 * La validación se muestra al salir de cada campo, no mientras se escribe:
 * marcar en rojo un correo a medio escribir es molesto y no ayuda.
 */
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { MarcoAuth } from "@/components/MarcoAuth";
import { colores, fuente } from "@/constants/tema";
import { useSesion } from "@/sesion/SesionContexto";
import { ErrorAuth, emailValido, problemaPassword } from "@/servicios/auth";

export default function Registro() {
  const { registrarse } = useSesion();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const marcar = (campo: string) => () => setTocado((t) => ({ ...t, [campo]: true }));

  const errorNombre = nombre.trim().length >= 2 ? null : "Escribe tu nombre.";
  const errorEmail = emailValido(email) ? null : "Revisa el correo.";
  const errorPassword = problemaPassword(password);
  const errorConfirmacion = password === confirmacion ? null : "Las contraseñas no coinciden.";

  const completo = !errorNombre && !errorEmail && !errorPassword && !errorConfirmacion;

  async function enviar() {
    setTocado({ nombre: true, email: true, password: true, confirmacion: true });
    if (!completo) return;

    setError(null);
    setEnviando(true);
    try {
      await registrarse({ nombre, email, password });
      // El layout raíz detecta la sesión y entra a la aplicación.
    } catch (e) {
      setError(e instanceof ErrorAuth ? e.message : "No se pudo conectar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAuth
      titulo="Crear cuenta"
      bajada="Tu sueldo y tus gastos fijos se configuran una vez. Después no vuelves a escribirlos."
      pie={
        <Text style={estilos.pieTexto}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/sesion" style={estilos.enlace}>
            Entrar
          </Link>
        </Text>
      }
    >
      <Campo
        etiqueta="Nombre"
        value={nombre}
        onChangeText={setNombre}
        onBlur={marcar("nombre")}
        error={tocado.nombre ? errorNombre : null}
        placeholder="Cómo te llamas"
        autoComplete="name"
        textContentType="name"
      />

      <Campo
        etiqueta="Correo"
        value={email}
        onChangeText={setEmail}
        onBlur={marcar("email")}
        error={tocado.email ? errorEmail : null}
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
        onBlur={marcar("password")}
        error={tocado.password ? errorPassword : null}
        placeholder="Al menos 8 caracteres"
        secreto
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Campo
        etiqueta="Repetir contraseña"
        value={confirmacion}
        onChangeText={setConfirmacion}
        onBlur={marcar("confirmacion")}
        error={tocado.confirmacion ? errorConfirmacion : null}
        placeholder="La misma de arriba"
        secreto
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Boton titulo="Crear cuenta" onPress={enviar} cargando={enviando} />

      <Text style={estilos.aviso}>
        Velvet Wallet nunca pide ni guarda la clave de tu banco. La autorización ocurre en el sitio de
        la institución.
      </Text>
    </MarcoAuth>
  );
}

const estilos = StyleSheet.create({
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, textAlign: "center" },
  pieTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15 },
  enlace: { color: colores.acento, fontFamily: fuente.textoFuerte },
  aviso: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
