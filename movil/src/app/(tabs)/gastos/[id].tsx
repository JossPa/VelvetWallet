/**
 * Detalle de un movimiento: lo que dijo el banco, lo que entendió el sistema,
 * las acciones de corrección y la trazabilidad.
 *
 * La regla que esta pantalla hace visible: la corrección del usuario se guarda
 * aparte y el dato original del banco nunca se modifica (RF-14 / RNF-31).
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ficha } from "@/components/Ficha";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { CONEXIONES } from "@/datos/conexiones";
import { MOVIMIENTOS } from "@/datos/movimientos";
import type { Correccion, Movimiento, OrigenMovimiento } from "@/modelo/tipos";
import { fechaCorta, fechaHora, pesos } from "@/utils/formato";

const ORIGEN: Record<OrigenMovimiento, string> = {
  sfa: "API SFA",
  cartola: "Cartola CSV",
  manual: "Carga manual",
};

const TIPO_CORRECCION: Record<Correccion["tipo"], string> = {
  recategorizar: "Recategorizado",
  marcar_duplicado: "Marcado duplicado",
  excluir: "Excluido",
  dividir: "Dividido",
};

const ACCIONES = ["Asignar categoría", "Dividir en varias", "Marcar duplicado", "Excluir del gasto"];

/** Tipo de la cuenta a la que pertenece el movimiento ("Cuenta Corriente"). */
function tipoCuenta(m: Movimiento): string | undefined {
  for (const c of CONEXIONES) {
    const cuenta = c.cuentas.find((x) => x.id === m.cuentaId);
    if (cuenta) return cuenta.tipo;
  }
}

function resumenCorrecciones(lista: Correccion[]): string {
  if (lista.length === 0) return "Ninguna";
  if (lista.length === 1) return TIPO_CORRECCION[lista[0].tipo];
  return `${lista.length} correcciones`;
}

export default function DetalleMovimiento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const m = MOVIMIENTOS.find((x) => x.id === id);

  if (!m) {
    return (
      <Pantalla titulo="Movimiento" onAtras={() => router.back()}>
        <Nota>No se encontró el movimiento {id}.</Nota>
      </Pantalla>
    );
  }

  const esCargo = m.monto < 0;
  const subtitulo = [m.institucion, tipoCuenta(m), fechaHora(m.fecha)].filter(Boolean).join(" · ");
  const sinIdentificar = m.comercio === null;

  return (
    <Pantalla titulo="Movimiento" etiqueta={fechaCorta(m.fecha)} onAtras={() => router.back()}>
      <Ficha
        encabezado={
          <View style={estilos.encabezado}>
            <Text style={estilos.monto}>
              {esCargo ? "" : "+"}
              {pesos(Math.abs(m.monto))}
            </Text>
            <Text style={estilos.subtitulo}>{subtitulo}</Text>
          </View>
        }
        filas={[
          { etiqueta: "Glosa original", valor: m.glosaOriginal, mono: true },
          { etiqueta: "Comercio", valor: m.comercio ?? "No identificado", destacar: sinIdentificar },
          { etiqueta: "Categoría", valor: m.categoria ?? "Sin categorizar", destacar: m.categoria === null },
          ...(m.categoriaBanco ? [{ etiqueta: "Categoría del banco", valor: m.categoriaBanco }] : []),
          { etiqueta: "Estado", valor: m.excluido ? "Excluido" : "Confirmado" },
          { etiqueta: "Origen", valor: ORIGEN[m.origen] },
        ]}
      />

      <Seccion titulo="Corregir" />
      <View style={estilos.acciones}>
        {ACCIONES.map((texto) => (
          <Pressable key={texto} style={({ pressed }) => [estilos.accion, pressed && estilos.accionPresionada]}>
            <Text style={estilos.accionTexto}>{texto}</Text>
          </Pressable>
        ))}
      </View>

      <Seccion titulo="Trazabilidad" />
      <Ficha
        filas={[
          { etiqueta: "Recibido", valor: fechaHora(m.recibidoEn) },
          { etiqueta: "Payload crudo", valor: m.payloadCrudoRef ?? "—", mono: true },
          { etiqueta: "Correcciones", valor: resumenCorrecciones(m.correcciones) },
        ]}
      />

      <Text style={estilos.pie}>Tu corrección no modifica el dato del banco.</Text>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  encabezado: { paddingTop: espacio.l, paddingBottom: espacio.m, gap: espacio.xs },
  monto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 40, letterSpacing: -1 },
  subtitulo: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15 },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: espacio.m },
  accion: {
    // Dos por fila: mitad del ancho menos la mitad del espacio entre ambas
    width: "48%",
    flexGrow: 1,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    paddingVertical: espacio.l,
    alignItems: "center",
  },
  accionPresionada: { opacity: 0.7 },
  accionTexto: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15 },
  pie: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 14,
    textAlign: "center",
    marginTop: espacio.l,
  },
});
