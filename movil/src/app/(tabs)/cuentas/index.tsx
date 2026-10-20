/**
 * Cuentas — instituciones conectadas y derechos sobre los datos.
 *
 * Los cuatro enlaces de "Tus datos" corresponden a derechos de la Ley 21.719:
 * acceso, portabilidad, registro de tratamiento y supresión.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { FilaConexion } from "@/components/FilaConexion";
import { Ficha } from "@/components/Ficha";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente } from "@/constants/tema";
import { CONEXIONES } from "@/datos/conexiones";
import { useSesion } from "@/sesion/SesionContexto";

const DERECHOS = [
  "Qué autorizaste y por cuánto tiempo",
  "Descargar todos mis datos",
  "Bitácora de accesos",
  "Eliminar mi cuenta y mis datos",
];

export default function Cuentas() {
  const { usuario, salir } = useSesion();
  const conexiones = CONEXIONES;

  return (
    <Pantalla titulo="Cuentas" etiqueta={`${conexiones.length} conectadas`}>
      <Seccion titulo="Tu perfil" />
      <Ficha
        filas={[
          { etiqueta: "Nombre", valor: usuario?.nombre ?? "—" },
          { etiqueta: "Correo", valor: usuario?.email ?? "—" },
        ]}
      />

      <Seccion titulo="Instituciones" />
      <View>
        {conexiones.map((c) => (
          <FilaConexion key={c.id} conexion={c} />
        ))}
      </View>

      <Seccion titulo="Tus datos" />
      {DERECHOS.map((texto) => (
        <Pressable key={texto} style={({ pressed }) => [estilos.enlace, pressed && estilos.enlacePresionado]}>
          <Text style={estilos.enlaceTexto}>{texto}</Text>
        </Pressable>
      ))}

      <Nota>
        Velvet Wallet nunca pide ni guarda tu clave del banco. La autorización ocurre en el sitio de
        la institución.
      </Nota>

      <Boton titulo="Cerrar sesión" onPress={salir} secundario style={estilos.salir} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  enlace: { paddingVertical: espacio.m },
  enlacePresionado: { opacity: 0.7 },
  enlaceTexto: { color: colores.acento, fontFamily: fuente.textoFuerte, fontSize: 16 },
  salir: { marginTop: espacio.xl },
});
