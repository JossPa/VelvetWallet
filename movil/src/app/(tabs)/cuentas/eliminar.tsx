/**
 * Eliminar mi cuenta y mis datos — derecho de supresión (Ley 21.719).
 *
 * Es la pantalla más delicada de la aplicación y por eso es la que menos
 * intenta ayudar: no hay atajos, no hay un botón grande y cómodo, y el botón
 * final solo se habilita cuando la persona escribe su propio correo.
 *
 * La fricción acá es la funcionalidad. Un borrado irreversible que se dispara
 * con un toque es un error de diseño, no una comodidad.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { eliminarCuenta } from "@/servicios/privacidad";
import { useSesion } from "@/sesion/SesionContexto";

const SE_BORRA = [
  "Tus movimientos y las cuentas bancarias vinculadas",
  "Tus metas de ahorro",
  "Las correcciones de categoría que hiciste",
  "Tus autorizaciones y tu perfil",
];

export default function Eliminar() {
  const router = useRouter();
  const { usuario, salir } = useSesion();
  const [correo, setCorreo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coincide =
    correo.trim().toLowerCase() === (usuario?.email ?? "").trim().toLowerCase() &&
    correo.trim() !== "";

  async function eliminar() {
    if (!coincide) return;
    setOcupado(true);
    setError(null);
    try {
      await eliminarCuenta(correo.trim());
      // La sesión ya no apunta a nada: se cierra y se vuelve al inicio.
      await salir();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la cuenta.");
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Eliminar cuenta" onAtras={() => router.back()}>
      <View style={estilos.aviso}>
        <Ionicons name="warning-outline" size={22} color={colores.alerta} />
        <Text style={estilos.avisoTexto}>
          Esto no se puede deshacer. No hay papelera ni periodo de gracia: al confirmar, tus datos
          se borran de inmediato.
        </Text>
      </View>

      <Seccion titulo="Qué se borra" />
      <View style={estilos.tarjeta}>
        {SE_BORRA.map((linea) => (
          <View key={linea} style={estilos.fila}>
            <Ionicons name="close" size={16} color={colores.acento} style={estilos.marca} />
            <Text style={estilos.filaTexto}>{linea}</Text>
          </View>
        ))}
      </View>

      <Seccion titulo="Qué no se borra" />
      <Nota>
        Tu bitácora sobrevive, pero deja de estar asociada a ti: pierde tu identificador y queda
        anónima. La ley obliga a poder demostrar qué se hizo con los datos, y ese registro no puede
        desaparecer junto con ellos. No contiene tus movimientos, solo qué se tocó y cuándo.
      </Nota>

      <Nota>
        Si lo que quieres es dejar de compartir tus datos con nosotros, no hace falta borrar la
        cuenta: puedes desvincular tu banco o revocar el uso de tus datos y conservar todo lo demás.
      </Nota>

      <Seccion titulo="Confirmar" />
      <Text style={estilos.instruccion}>
        Escribe <Text style={estilos.correo}>{usuario?.email ?? "tu correo"}</Text> para confirmar
        que eres tú.
      </Text>
      <Campo
        etiqueta="Tu correo"
        placeholder={usuario?.email ?? ""}
        value={correo}
        onChangeText={setCorreo}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Boton
        titulo="Eliminar mi cuenta y mis datos"
        onPress={eliminar}
        cargando={ocupado}
        deshabilitado={!coincide}
        style={estilos.boton}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flexDirection: "row",
    gap: espacio.m,
    backgroundColor: colores.alertaSuave,
    borderRadius: radio.l,
    padding: espacio.l,
    alignItems: "flex-start",
  },
  avisoTexto: { color: colores.texto, fontFamily: fuente.texto, fontSize: 14.5, lineHeight: 21, flex: 1 },
  tarjeta: { backgroundColor: colores.tarjeta, borderRadius: radio.l, padding: espacio.l, gap: espacio.m },
  fila: { flexDirection: "row", gap: espacio.m, alignItems: "flex-start" },
  marca: { marginTop: 2 },
  filaTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20, flex: 1 },
  instruccion: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: espacio.m,
  },
  correo: { color: colores.texto, fontFamily: fuente.mono, fontSize: 13.5 },
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.m },
  boton: { marginTop: espacio.l },
});
