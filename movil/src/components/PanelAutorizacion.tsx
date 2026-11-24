/**
 * Panel de autorización: explica qué se pide y manda al usuario al SITIO DE SU
 * BANCO. Allá inicia sesión con su RUT y su clave y aprueba; Velvet no ve ni
 * guarda esos datos (OAuth del SFA). El banco lo devuelve a la app.
 *
 * Lo usan Inicio (primer banco, "Conectar otro") y Cuentas (conectar otro
 * banco, renovar un permiso): un solo lugar donde se dice qué se autoriza.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Chips } from "@/components/Chips";
import { espacio, fuente, radio } from "@/constants/tema";
import { crearEstilos } from "@/tema/TemaContexto";
import type { VueltaDelBanco } from "@/datos/MovimientosContexto";

/** Mensaje para el usuario según cómo volvió del sitio del banco. */
export function mensajeDeVuelta(v: VueltaDelBanco): string {
  if (v.banco === "rechazado") return "Rechazaste el acceso en tu banco. No se compartió nada.";
  if (v.motivo === "otro_cliente") {
    return "Este banco ya está vinculado a otro RUT en tu cuenta. Desvincúlalo antes de autorizar con otro.";
  }
  if (v.motivo === "expirado") {
    return "La autorización venció o ya se había usado. Vuelve a intentarlo.";
  }
  return "No se pudo completar la vinculación con tu banco. Intenta de nuevo.";
}

export function PanelAutorizacion({
  motivo,
  ocupado,
  onIrAlBanco,
  onCancelar,
  bancos,
  banco,
  onElegir,
}: {
  motivo?: string | null;
  ocupado: boolean;
  onIrAlBanco: () => void;
  onCancelar?: () => void;
  /** Los bancos que se pueden elegir. Con uno solo no se muestra la elección. */
  bancos: string[];
  banco: string;
  onElegir: (banco: string) => void;
}) {
  const estilos = useEstilos();
  return (
    <View style={estilos.consent}>
      <Text style={estilos.consentTitulo}>Autorización de acceso</Text>
      {motivo ? <Text style={estilos.consentMotivo}>{motivo}</Text> : null}
      {bancos.length > 1 ? (
        <View style={estilos.elegirBanco}>
          <Chips
            opciones={bancos.map((b) => ({ valor: b, etiqueta: b }))}
            valor={banco}
            onCambio={onElegir}
          />
        </View>
      ) : null}
      <Text style={estilos.consentTexto}>
        Velvet Wallet solicita tu permiso para leer, en tu banco:
      </Text>
      <Text style={estilos.consentItem}>•  Tus cuentas y saldos</Text>
      <Text style={estilos.consentItem}>•  Tus movimientos</Text>

      <Text style={estilos.consentNota}>
        Te llevaremos al sitio de {banco}. Inicias sesión allá con tu RUT y tu clave y decides si
        autorizas. Velvet nunca ve tu clave, y puedes revocar el acceso cuando quieras.
      </Text>

      <Boton
        titulo={ocupado ? "Abriendo tu banco…" : `Ir a ${banco}`}
        onPress={onIrAlBanco}
        cargando={ocupado}
        style={estilos.autorizar}
      />
      {!ocupado && onCancelar ? (
        <Pressable onPress={onCancelar} style={estilos.cancelar}>
          <Text style={estilos.cancelarTexto}>Cancelar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useEstilos = crearEstilos((colores) => StyleSheet.create({
  consent: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.s,
    gap: espacio.s,
  },
  consentTitulo: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 16, marginBottom: espacio.xs },
  consentMotivo: { color: colores.alerta, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19 },
  consentTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20 },
  consentItem: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 14, lineHeight: 22 },
  consentNota: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12, lineHeight: 18, marginTop: espacio.xs },
  elegirBanco: { marginTop: espacio.m, marginBottom: -espacio.s },
  autorizar: { marginTop: espacio.m },
  cancelar: { alignItems: "center", paddingVertical: espacio.s, marginTop: espacio.xs },
  cancelarTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 14 },
}));
