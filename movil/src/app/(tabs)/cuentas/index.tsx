/**
 * Cuentas — instituciones conectadas y derechos sobre los datos.
 *
 * Los enlaces de "Tus datos" corresponden a derechos de la Ley 21.719:
 * información sobre las finalidades, acceso a lo autorizado, portabilidad,
 * registro de tratamiento, notificación de brechas y supresión.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { FilaConexion } from "@/components/FilaConexion";
import { Ficha } from "@/components/Ficha";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente } from "@/constants/tema";
import { useMovimientos } from "@/datos/MovimientosContexto";
import { useSesion } from "@/sesion/SesionContexto";
import { pesos } from "@/utils/formato";

/**
 * Los cinco derechos del titular que reconoce la Ley 21.719, cada uno con su
 * pantalla. `peligro` marca el que no tiene vuelta atrás.
 */
const DERECHOS: { texto: string; ruta: string; peligro?: boolean }[] = [
  { texto: "Para qué usamos tus datos", ruta: "/cuentas/privacidad" },
  { texto: "Qué autorizaste y por cuánto tiempo", ruta: "/cuentas/autorizaciones" },
  { texto: "Descargar todos mis datos", ruta: "/cuentas/exportar" },
  { texto: "Bitácora de accesos", ruta: "/cuentas/bitacora" },
  { texto: "Avisos de seguridad", ruta: "/cuentas/incidentes" },
  { texto: "Eliminar mi cuenta y mis datos", ruta: "/cuentas/eliminar", peligro: true },
];

export default function Cuentas() {
  const router = useRouter();
  const { usuario, salir } = useSesion();
  // Las instituciones salen del backend, que es el único que sabe qué permiso
  // está vigente y de cuándo es el dato. La vinculación y la desvinculación
  // viven en Inicio: aquí solo se muestra el estado.
  const { conexiones, sincronizando } = useMovimientos();

  const etiqueta = conexiones.length === 1 ? "1 conectada" : `${conexiones.length} conectadas`;

  return (
    <Pantalla titulo="Cuentas" etiqueta={sincronizando ? "Actualizando…" : etiqueta}>
      <Seccion titulo="Tu perfil" />
      <Ficha
        filas={[
          { etiqueta: "Nombre", valor: usuario?.nombre ?? "—" },
          { etiqueta: "Correo", valor: usuario?.email ?? "—" },
          {
            etiqueta: "Sueldo mensual",
            // Sin declarar no se muestra el estimado: aquí solo cabe una línea
            // y un número sin su evidencia al lado se lee como un hecho. La
            // estimación se explica en su pantalla, donde sí cabe justificarla.
            valor: usuario?.sueldoDeclarado != null ? pesos(usuario.sueldoDeclarado) : "Sin declarar",
            destacar: usuario?.sueldoDeclarado == null,
          },
        ]}
      />
      <Pressable
        onPress={() => router.push("/cuentas/sueldo")}
        style={({ pressed }) => [estilos.enlace, pressed && estilos.enlacePresionado]}
      >
        <Text style={estilos.enlaceTexto}>
          {usuario?.sueldoDeclarado != null ? "Cambiar mi sueldo" : "Configurar mi sueldo"}
        </Text>
        <Ionicons name="chevron-forward" size={17} color={colores.acento} />
      </Pressable>

      <Seccion titulo="Instituciones" />
      {conexiones.length === 0 ? (
        <Nota>
          Todavía no has autorizado ninguna institución. Puedes conectar tu banco desde Inicio.
        </Nota>
      ) : (
        <View>
          {conexiones.map((c) => (
            <FilaConexion key={c.id} conexion={c} />
          ))}
        </View>
      )}

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
