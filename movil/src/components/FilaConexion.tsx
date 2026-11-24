/**
 * Una institución conectada: punto de estado, nombre, línea de detalle, sus
 * cuentas con saldo y, si la autorización venció, el botón para renovarla.
 *
 * La línea de detalle distingue el estado del PERMISO del estado del DATO. Un
 * permiso vigente no garantiza que lo que se muestra esté actualizado, y RF-35
 * pide decirlo en vez de presentar un total como si estuviera completo.
 */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tocable } from "@/components/Movimiento";
import { espacio, fuente, radio } from "@/constants/tema";
import type { Paleta } from "@/constants/tema";
import { crearEstilos, useColores } from "@/tema/TemaContexto";
import type { Conexion, CuentaConectada } from "@/modelo/tipos";
import { fechaCorta, pesos, tiempoRelativo } from "@/utils/formato";

/** Traduce el estado a lo que ve el usuario. Único lugar donde se decide. */
function describirEstado(c: Conexion, colores: Paleta): { color: string; texto: string } {
  // Sin banco al que preguntar: el dato llega hasta donde llegó lo importado
  // o lo anotado, y eso es lo que hay que decir (RF-35).
  if (c.fuente === "cartola") {
    return {
      color: colores.texto3,
      texto: c.datosHasta ? `Cartola · datos hasta el ${fechaCorta(c.datosHasta)}` : "Cartola",
    };
  }
  if (c.fuente === "manual") {
    return { color: colores.texto3, texto: "Anotado a mano" };
  }
  switch (c.estado) {
    case "autorizacion_vencida":
      return {
        color: colores.alerta,
        texto: `Autorización vencida${
          c.autorizacionVencioEl ? " el " + fechaCorta(c.autorizacionVencioEl) : ""
        }`,
      };
    case "sin_respuesta":
      return {
        color: colores.acento,
        texto: c.ultimaSincronizacion
          ? `No responde · datos ${tiempoRelativo(c.ultimaSincronizacion)}`
          : "No responde",
      };
    case "al_dia":
      if (!c.ultimaSincronizacion) {
        return { color: colores.acento, texto: "Autorizado, sin sincronizar aún" };
      }
      // El permiso está bien pero el dato ya tiene edad: se dice, no se tapa.
      return c.datoAntiguo
        ? { color: colores.acento, texto: `Sin actualizar · ${tiempoRelativo(c.ultimaSincronizacion)}` }
        : { color: colores.ok, texto: `Al día · ${tiempoRelativo(c.ultimaSincronizacion)}` };
  }
}

type Props = {
  conexion: Conexion;
  onReautorizar?: (c: Conexion) => void;
  /** Solo para bancos del SFA: retira el permiso y borra sus datos de Velvet. */
  onDesvincular?: (c: Conexion) => Promise<void> | void;
  /** Abre los movimientos de una cuenta. Sin él, las cuentas no se pueden tocar. */
  onAbrirCuenta?: (cuenta: CuentaConectada, c: Conexion) => void;
};

/**
 * Cómo se nombra una cuenta: el apodo del banco si lo hay ("Cuenta sueldo"),
 * con el tipo y el número abajo para no perder qué producto es.
 */
export function nombreCuenta(cuenta: CuentaConectada): { titulo: string; detalle: string | null } {
  const tipo = cuenta.tipo + (cuenta.numeroEnmascarado ? ` ${cuenta.numeroEnmascarado}` : "");
  return cuenta.apodo ? { titulo: cuenta.apodo, detalle: tipo } : { titulo: tipo, detalle: null };
}

export function FilaConexion({ conexion, onReautorizar, onDesvincular, onAbrirCuenta }: Props) {
  const estilos = useEstilos();
  const colores = useColores();
  const estado = describirEstado(conexion, colores);
  const esDelSfa = (conexion.fuente ?? "sfa") === "sfa";
  const necesitaAccion = esDelSfa && conexion.estado === "autorizacion_vencida";
  const [confirmar, setConfirmar] = useState(false);
  const [quitando, setQuitando] = useState(false);

  return (
    <View style={estilos.fila}>
      <View style={estilos.encabezado}>
        <View style={[estilos.punto, { backgroundColor: estado.color }]} />
        <View style={estilos.textos}>
          <Text style={estilos.nombre}>{conexion.institucion}</Text>
          <Text style={estilos.detalle}>{estado.texto}</Text>
        </View>
        {necesitaAccion ? (
          <Tocable onPress={() => onReautorizar?.(conexion)} style={estilos.boton}>
            <Text style={estilos.botonTexto}>Reautorizar</Text>
          </Tocable>
        ) : null}
      </View>

      {conexion.cuentas.map((cuenta) => {
        const { titulo, detalle } = nombreCuenta(cuenta);
        const contenido = (
          <>
            <View style={estilos.cuentaTextos}>
              <Text style={estilos.cuentaNombre} numberOfLines={1}>{titulo}</Text>
              {detalle ? <Text style={estilos.cuentaDetalle} numberOfLines={1}>{detalle}</Text> : null}
            </View>
            <Text style={[estilos.cuentaSaldo, (cuenta.saldo ?? 0) < 0 && estilos.cuentaNegativa]}>
              {/* El banco puede no informar saldo de un producto: no se inventa un 0. */}
              {cuenta.saldo === null ? "—" : pesos(cuenta.saldo)}
            </Text>
          </>
        );
        return onAbrirCuenta ? (
          <Tocable
            key={cuenta.id}
            style={estilos.cuenta}
            onPress={() => onAbrirCuenta(cuenta, conexion)}
            accessibilityRole="button"
            accessibilityLabel={`${titulo}, ver movimientos`}
          >
            {contenido}
            <Ionicons name="chevron-forward" size={16} color={colores.texto3} />
          </Tocable>
        ) : (
          <View key={cuenta.id} style={estilos.cuenta}>{contenido}</View>
        );
      })}

      {esDelSfa && onDesvincular ? (
        confirmar ? (
          <View style={estilos.confirmar}>
            <Text style={estilos.confirmarTexto}>
              Se revoca el permiso en {conexion.institucion} y se borran de Velvet sus cuentas y
              movimientos. Tus otros bancos no se tocan.
            </Text>
            <View style={estilos.confirmarAcciones}>
              <Text style={estilos.enlaceApagado} onPress={() => setConfirmar(false)}>Cancelar</Text>
              <Text
                style={estilos.enlacePeligro}
                onPress={async () => {
                  if (quitando) return;
                  setQuitando(true);
                  try {
                    await onDesvincular(conexion);
                  } finally {
                    setQuitando(false);
                    setConfirmar(false);
                  }
                }}
              >
                {quitando ? "Desvinculando…" : "Sí, desvincular"}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={estilos.desvincular} onPress={() => setConfirmar(true)}>
            Desvincular
          </Text>
        )
      ) : null}
    </View>
  );
}

const useEstilos = crearEstilos((colores) => StyleSheet.create({
  fila: {
    paddingVertical: espacio.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.linea,
  },
  encabezado: { flexDirection: "row", alignItems: "center" },
  punto: { width: 8, height: 8, borderRadius: 4, marginRight: espacio.m },
  textos: { flex: 1, gap: 2 },
  nombre: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17 },
  detalle: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14 },
  cuenta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espacio.m,
    // Alineadas bajo el nombre, no bajo el punto de estado.
    marginLeft: 8 + espacio.m,
    marginTop: espacio.s,
    minHeight: 36,
  },
  cuentaTextos: { flex: 1, gap: 1 },
  cuentaNombre: { color: colores.texto, fontFamily: fuente.textoMedio, fontSize: 14 },
  cuentaDetalle: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12 },
  cuentaSaldo: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 14 },
  cuentaNegativa: { color: colores.alerta },
  boton: {
    backgroundColor: colores.acento,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.s + 2,
    borderRadius: radio.m,
    marginLeft: espacio.m,
  },
  botonTexto: { color: colores.sobreAcento, fontFamily: fuente.textoFuerte, fontSize: 14 },
  desvincular: {
    color: colores.texto2,
    fontFamily: fuente.textoMedio,
    fontSize: 13,
    marginLeft: 8 + espacio.m,
    marginTop: espacio.s,
  },
  confirmar: { marginLeft: 8 + espacio.m, marginTop: espacio.s, gap: espacio.s },
  confirmarTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13, lineHeight: 18 },
  confirmarAcciones: { flexDirection: "row", gap: espacio.l },
  enlaceApagado: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 14 },
  enlacePeligro: { color: colores.alerta, fontFamily: fuente.textoFuerte, fontSize: 14 },
}));
