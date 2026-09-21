/**
 * Una institución conectada: punto de estado, nombre, línea de detalle y,
 * si la autorización venció, el botón para renovarla.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colores, espacio, fuente, radio } from "@/constants/tema";
import type { Conexion } from "@/modelo/tipos";
import { fechaCorta, tiempoRelativo } from "@/utils/formato";

/** Traduce el estado a lo que ve el usuario. Único lugar donde se decide. */
function describirEstado(c: Conexion): { color: string; texto: string } {
  switch (c.estado) {
    case "al_dia":
      return { color: colores.ok, texto: `Al día · ${tiempoRelativo(c.ultimaSincronizacion)}` };
    case "sin_respuesta":
      return { color: colores.acento, texto: `No responde · ${tiempoRelativo(c.ultimaSincronizacion)}` };
    case "autorizacion_vencida":
      return {
        color: colores.alerta,
        texto: `Autorización vencida ${c.autorizacionVencioEl ? "el " + fechaCorta(c.autorizacionVencioEl) : ""}`.trim(),
      };
  }
}

type Props = {
  conexion: Conexion;
  onReautorizar?: (c: Conexion) => void;
};

export function FilaConexion({ conexion, onReautorizar }: Props) {
  const estado = describirEstado(conexion);
  const necesitaAccion = conexion.estado === "autorizacion_vencida";

  return (
    <View style={estilos.fila}>
      <View style={[estilos.punto, { backgroundColor: estado.color }]} />
      <View style={estilos.textos}>
        <Text style={estilos.nombre}>{conexion.institucion}</Text>
        <Text style={estilos.detalle}>{estado.texto}</Text>
      </View>
      {necesitaAccion ? (
        <Pressable
          onPress={() => onReautorizar?.(conexion)}
          style={({ pressed }) => [estilos.boton, pressed && estilos.botonPresionado]}
        >
          <Text style={estilos.botonTexto}>Reautorizar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: espacio.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.linea,
  },
  punto: { width: 8, height: 8, borderRadius: 4, marginRight: espacio.m },
  textos: { flex: 1, gap: 2 },
  nombre: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17 },
  detalle: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14 },
  boton: {
    backgroundColor: colores.acento,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.s + 2,
    borderRadius: radio.m,
    marginLeft: espacio.m,
  },
  botonPresionado: { opacity: 0.85 },
  botonTexto: { color: "#FFFFFF", fontFamily: fuente.textoFuerte, fontSize: 14 },
});
