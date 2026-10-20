/**
 * Cuentas — instituciones conectadas y derechos sobre los datos.
 *
 * Los cuatro enlaces de "Tus datos" corresponden a derechos de la Ley 21.719:
 * acceso, portabilidad, registro de tratamiento y supresión.
 */
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { FilaConexion } from "@/components/FilaConexion";
import { Ficha } from "@/components/Ficha";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente } from "@/constants/tema";
import { CONEXIONES } from "@/datos/conexiones";
import { useSesion } from "@/sesion/SesionContexto";

/** `ruta` null = la pantalla todavía no existe (bloque I, semanas 11-14). */
const DERECHOS: { texto: string; ruta: string | null }[] = [
  { texto: "Para qué usamos tus datos", ruta: "/cuentas/privacidad" },
  { texto: "Qué autorizaste y por cuánto tiempo", ruta: null },
  { texto: "Descargar todos mis datos", ruta: null },
  { texto: "Bitácora de accesos", ruta: null },
  { texto: "Eliminar mi cuenta y mis datos", ruta: null },
];

export default function Cuentas() {
  const router = useRouter();
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
      {DERECHOS.map(({ texto, ruta }) => (
        <Pressable
          key={texto}
          onPress={ruta ? () => router.push(ruta as never) : undefined}
          style={({ pressed }) => [estilos.enlace, pressed && ruta && estilos.enlacePresionado]}
        >
          <Text style={[estilos.enlaceTexto, !ruta && estilos.enlacePendiente]}>{texto}</Text>
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
  // Sin ruta todavía: se ve como texto, no como algo en que valga la pena tocar.
  enlacePendiente: { color: colores.texto3 },
  salir: { marginTop: espacio.xl },
});
