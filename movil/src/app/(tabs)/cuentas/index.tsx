/**
 * Cuentas — instituciones conectadas y derechos sobre los datos.
 *
 * Los cinco enlaces de "Tus datos" corresponden a derechos de la Ley 21.719:
 * información sobre las finalidades, acceso a lo autorizado, portabilidad,
 * registro de tratamiento y supresión.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { FilaConexion } from "@/components/FilaConexion";
import { Ficha } from "@/components/Ficha";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente } from "@/constants/tema";
import { CONEXIONES } from "@/datos/conexiones";
import { useSesion } from "@/sesion/SesionContexto";

/**
 * Los cinco derechos del titular que reconoce la Ley 21.719, cada uno con su
 * pantalla. `peligro` marca el que no tiene vuelta atrás.
 */
const DERECHOS: { texto: string; ruta: string; peligro?: boolean }[] = [
  { texto: "Para qué usamos tus datos", ruta: "/cuentas/privacidad" },
  { texto: "Qué autorizaste y por cuánto tiempo", ruta: "/cuentas/autorizaciones" },
  { texto: "Descargar todos mis datos", ruta: "/cuentas/exportar" },
  { texto: "Bitácora de accesos", ruta: "/cuentas/bitacora" },
  { texto: "Eliminar mi cuenta y mis datos", ruta: "/cuentas/eliminar", peligro: true },
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
      {DERECHOS.map(({ texto, ruta, peligro }) => (
        <Pressable
          key={texto}
          onPress={() => router.push(ruta as never)}
          style={({ pressed }) => [estilos.enlace, pressed && estilos.enlacePresionado]}
        >
          <Text style={[estilos.enlaceTexto, peligro && estilos.enlacePeligro]}>{texto}</Text>
          <Ionicons
            name="chevron-forward"
            size={17}
            color={peligro ? colores.texto3 : colores.acento}
          />
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
  enlace: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: espacio.m,
  },
  enlacePresionado: { opacity: 0.7 },
  enlaceTexto: { color: colores.acento, fontFamily: fuente.textoFuerte, fontSize: 16 },
  // El borrado no se destaca: no es una acción que haya que invitar a tocar.
  enlacePeligro: { color: colores.texto2 },
  salir: { marginTop: espacio.xl },
});
