/**
 * Tarjeta del gasto más grande del período.
 *
 * El panel muestra el reparto por categoría y deja al usuario buscando con la
 * vista cuál es la porción más grande. Esto lo dice directo, y además baja un
 * nivel: no solo "Supermercado", sino en qué comercio y cuál fue el cargo más
 * grande de todos. Es la entrada al desglose completo.
 *
 * Es solo presentación: los números llegan calculados desde `utils/desglose`,
 * de modo que coinciden con el gráfico por construcción y no por coincidencia.
 */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AvatarComercio } from "@/components/AvatarComercio";
import { Cifra } from "@/components/Cifra";
import { Tocable } from "@/components/Movimiento";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import type { Desglose } from "@/utils/desglose";
import { fechaCorta, pesos } from "@/utils/formato";

type Props = {
  desglose: Desglose;
  /** Texto del período: "en octubre", "en los últimos 6 meses". */
  periodo: string;
  onPress: () => void;
};

export function GastoMasGrande({ desglose, periodo, onPress }: Props) {
  const { categoria, total, cantidad, fraccionDelGasto, mayor, grupos } = desglose;
  const principal = grupos[0];

  return (
    <Tocable onPress={onPress} style={estilos.tarjeta}>
      <View style={estilos.encabezado}>
        <Text style={estilos.rotulo}>TU GASTO MÁS GRANDE</Text>
        <Ionicons name="chevron-forward" size={17} color={colores.texto3} />
      </View>

      <Text style={estilos.categoria}>{categoria}</Text>
      <Cifra valor={total} style={estilos.monto} />
      <Text style={estilos.contexto}>
        {Math.round(fraccionDelGasto * 100)}% de lo que gastaste {periodo} ·{" "}
        {cantidad} {cantidad === 1 ? "movimiento" : "movimientos"}
      </Text>

      {mayor ? (
        <View style={estilos.detalle}>
          <AvatarComercio
            nombre={mayor.comercio ?? mayor.glosaOriginal}
            sinIdentificar={!mayor.comercio}
            tamano={36}
          />
          <View style={estilos.identidad}>
            <Text style={estilos.pista}>EL CARGO MÁS GRANDE</Text>
            <Text style={estilos.nombre} numberOfLines={1}>
              {mayor.comercio ?? mayor.glosaOriginal}
            </Text>
            <Text style={estilos.pie}>
              {fechaCorta(mayor.fecha)}
              {principal && principal.cantidad > 1
                ? ` · ${principal.cantidad} compras en ${principal.nombre}`
                : ""}
            </Text>
          </View>
          <Text style={estilos.montoDetalle}>{pesos(Math.abs(mayor.monto))}</Text>
        </View>
      ) : null}
    </Tocable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  encabezado: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rotulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 11, letterSpacing: 1.2 },
  categoria: { color: colores.texto2, fontFamily: fuente.textoFuerte, fontSize: 15, marginTop: espacio.m },
  monto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 32, letterSpacing: -0.7, marginTop: 2 },
  contexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, marginTop: 2 },

  detalle: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    marginTop: espacio.l,
    paddingTop: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
  },
  identidad: { flex: 1, gap: 1 },
  pista: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 9.5, letterSpacing: 1 },
  nombre: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15 },
  pie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5 },
  montoDetalle: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 16 },
});
