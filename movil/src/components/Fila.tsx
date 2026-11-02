/**
 * La fila que lleva a otra pantalla, y el grupo que las agrupa.
 *
 * Existe porque la app tenía tres versiones distintas de lo mismo: una fila
 * con icono y tarjeta en Gastos, un enlace rojo suelto en Cuentas y un enlace
 * rojo sin tarjeta en Inicio. Tres formas de decir "esto te lleva a otro
 * lado", y ninguna igual a la otra.
 *
 * **El color de la acción.** Las filas van en color de texto normal, no en el
 * rojo de la marca. El rojo de Velvet tiene que marcar *una* cosa por
 * pantalla: la acción principal, la pestaña activa, el monto que duele. Cuando
 * también marca cada enlace de navegación, deja de significar algo. Lo que
 * dice "esto se toca" es el chevrón y el icono, no el color —y eso además
 * funciona para quien no distingue el rojo.
 *
 * `tono="peligro"` existe para lo que no tiene vuelta atrás. Tampoco se pinta
 * de rojo: se le baja el peso. Borrar la cuenta no es algo a lo que haya que
 * invitar.
 */
import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tocable } from "@/components/Movimiento";
import { colores, espacio, fuente, radio } from "@/constants/tema";

type Tono = "normal" | "peligro";

type Props = {
  titulo: string;
  /** Segunda línea, para lo que la fila no alcanza a decir en el título. */
  detalle?: string;
  /** Icono de Ionicons. Sin él la fila va sin cuadro, solo texto y chevrón. */
  icono?: keyof typeof Ionicons.glyphMap;
  tono?: Tono;
  /** Texto corto a la derecha, antes del chevrón: un monto, un contador. */
  valor?: string;
  onPress: () => void;
  /** Para encadenarlas: la última del grupo no lleva divisor. */
  ultima?: boolean;
  /**
   * La fila abre y cierra contenido en el mismo lugar en vez de navegar.
   * El chevrón apunta hacia abajo o hacia arriba según el estado, que es lo
   * que distingue "esto se despliega" de "esto te lleva a otra pantalla".
   */
  expandido?: boolean;
};

export function Fila({
  titulo,
  detalle,
  icono,
  tono = "normal",
  valor,
  onPress,
  ultima,
  expandido,
}: Props) {
  const peligro = tono === "peligro";
  const chevron =
    expandido === undefined ? "chevron-forward" : expandido ? "chevron-up" : "chevron-down";

  return (
    <Tocable onPress={onPress} style={[estilos.fila, !ultima && estilos.conDivisor]}>
      {icono ? (
        <View style={estilos.cuadro}>
          <Ionicons name={icono} size={17} color={peligro ? colores.texto3 : colores.texto2} />
        </View>
      ) : null}

      <View style={estilos.centro}>
        {/* Dos líneas y no una: con el icono y el chevrón el ancho queda
            justo, y cortar "Qué autorizaste y por cuánto tie…" esconde
            justamente la parte que distingue a esa fila de las demás. */}
        <Text style={[estilos.titulo, peligro && estilos.tituloPeligro]} numberOfLines={2}>
          {titulo}
        </Text>
        {detalle ? <Text style={estilos.detalle} numberOfLines={2}>{detalle}</Text> : null}
      </View>

      {valor ? <Text style={estilos.valor}>{valor}</Text> : null}
      <Ionicons name={chevron} size={16} color={colores.texto3} />
    </Tocable>
  );
}

/**
 * Tarjeta que contiene una serie de filas.
 *
 * Agruparlas en una superficie con divisores es lo que convierte una lista de
 * enlaces sueltos en un menú: se lee como un bloque con un tema en común, no
 * como seis decisiones independientes.
 */
export function GrupoDeFilas({ children }: { children: ReactNode }) {
  return <View style={estilos.grupo}>{children}</View>;
}

const estilos = StyleSheet.create({
  grupo: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.l,
    overflow: "hidden",
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m + 2,
  },
  conDivisor: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.linea,
  },
  cuadro: {
    width: 32,
    height: 32,
    borderRadius: radio.s,
    backgroundColor: colores.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  centro: { flex: 1, gap: 1 },
  titulo: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15, lineHeight: 20 },
  tituloPeligro: { color: colores.texto2, fontFamily: fuente.texto },
  detalle: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5, lineHeight: 17 },
  valor: { color: colores.texto2, fontFamily: fuente.tituloMedio, fontSize: 14 },
});
