/**
 * Inicio — responde la primera pregunta del producto:
 * "¿Cuánto tengo disponible este mes?"
 *
 * Se muestra lo que ya funciona con datos reales del backend: disponible,
 * ingresos y gastos del mes, en qué se va la plata (por categoría) y cómo
 * cambió respecto al mes anterior.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Comparacion } from "@/components/Comparacion";
import { GraficoCategorias } from "@/components/GraficoCategorias";
import { Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { useMovimientos } from "@/datos/MovimientosContexto";
import { claveMes, nombreMes, pesos } from "@/utils/formato";
import {
  compararConMesAnterior,
  mesAnterior,
  repartoPorCategoria,
  resumenDelMes,
} from "@/utils/resumen";

/** Resumen de la última sincronización, en lenguaje natural. */
function describirResultado(r: { nuevos: number; actualizados: number }): string {
  const partes: string[] = [];
  if (r.nuevos > 0) partes.push(`${r.nuevos} ${r.nuevos === 1 ? "movimiento nuevo" : "movimientos nuevos"}`);
  if (r.actualizados > 0) {
    partes.push(`${r.actualizados} ${r.actualizados === 1 ? "actualizado" : "actualizados"}`);
  }
  return partes.length > 0 ? partes.join(" · ") : "Todo al día. No hay movimientos nuevos.";
}

export default function Inicio() {
  const router = useRouter();
  const { movimientos, sincronizando, sincronizar, conectar, error } = useMovimientos();
  const [resultado, setResultado] = useState<string | null>(null);
  const [solicitando, setSolicitando] = useState(false);

  async function alSincronizar() {
    setResultado(null);
    try {
      setResultado(describirResultado(await sincronizar()));
    } catch {
      // El mensaje ya quedó en `error`; se muestra abajo del botón.
    }
  }

  async function alConectar() {
    try {
      await conectar();
    } catch {
      // El mensaje ya quedó en `error`; se muestra abajo del botón.
    }
  }

  // Usuario sin movimientos todavía (p. ej. recién registrado): aún no vinculó
  // ningún banco. Aquí PIDE el permiso explícitamente — no se conecta solo.
  if (movimientos.length === 0) {
    return (
      <Pantalla titulo="Velvet Wallet" marca>
        <Text style={estilos.rotulo}>CONECTA TU PRIMER BANCO</Text>
        <Text style={estilos.bienvenida}>
          Aún no has vinculado ninguna cuenta. Conecta tu banco para traer tus movimientos.
        </Text>

        {!solicitando ? (
          <Boton
            titulo="Conectar mi banco"
            onPress={() => setSolicitando(true)}
            style={estilos.sincronizar}
          />
        ) : (
          <View style={estilos.consent}>
            <Text style={estilos.consentTitulo}>Autorización de acceso</Text>
            <Text style={estilos.consentTexto}>
              Velvet Wallet solicita tu permiso para acceder, en tu banco, a:
            </Text>
            <Text style={estilos.consentItem}>•  Tus cuentas y saldos</Text>
            <Text style={estilos.consentItem}>•  Tus movimientos</Text>
            <Text style={estilos.consentNota}>
              Velvet nunca ve ni guarda la clave de tu banco. Puedes revocar el acceso cuando quieras.
            </Text>

            <Boton
              titulo={sincronizando ? "Autorizando y trayendo tus datos…" : "Autorizar acceso"}
              onPress={alConectar}
              cargando={sincronizando}
              style={estilos.autorizar}
            />
            {!sincronizando ? (
              <Pressable onPress={() => setSolicitando(false)} style={estilos.cancelar}>
                <Text style={estilos.cancelarTexto}>Cancelar</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {error ? <Text style={estilos.error}>{error}</Text> : null}
      </Pantalla>
    );
  }

  const mes = claveMes(movimientos[0].fecha);
  const resumen = resumenDelMes(movimientos, mes);
  const reparto = repartoPorCategoria(movimientos, mes);
  const comparacion = compararConMesAnterior(movimientos, mes);

  return (
    <Pantalla titulo="Velvet Wallet" marca etiqueta={nombreMes(mes)}>
      <Text style={estilos.rotulo}>DISPONIBLE ESTE MES</Text>
      <Text style={[estilos.disponible, resumen.disponible < 0 && estilos.negativo]}>
        {pesos(resumen.disponible)}
      </Text>

      <Boton
        titulo={sincronizando ? "Consultando tu banco…" : "Sincronizar"}
        onPress={alSincronizar}
        cargando={sincronizando}
        secundario
        style={estilos.sincronizar}
      />

      {resultado ? (
        <Pressable onPress={() => router.push("/gastos")} style={estilos.resultado}>
          <Text style={estilos.resultadoTexto}>{resultado}</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <View style={estilos.par}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.rotuloTarjeta}>INGRESOS</Text>
          <Text style={estilos.cifra}>{pesos(resumen.ingresos)}</Text>
        </View>
        <View style={estilos.tarjeta}>
          <Text style={estilos.rotuloTarjeta}>GASTOS</Text>
          <Text style={estilos.cifra}>{pesos(resumen.gastos)}</Text>
          <Text style={estilos.pieTarjeta}>{resumen.cantidadGastos} movimientos</Text>
        </View>
      </View>

      {reparto.porciones.length > 0 ? (
        <>
          <Seccion titulo="En qué se te va" />
          <GraficoCategorias porciones={reparto.porciones} total={reparto.total} />
        </>
      ) : null}

      {comparacion ? (
        <>
          <Seccion titulo={`Comparado con ${nombreMes(mesAnterior(mes))}`} />
          <Comparacion variaciones={comparacion.variaciones} total={comparacion.total} />
        </>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  rotulo: {
    color: colores.texto3,
    fontFamily: fuente.tituloMedio,
    fontSize: 12,
    letterSpacing: 1.4,
    marginTop: espacio.s,
  },
  disponible: {
    color: colores.texto,
    fontFamily: fuente.titulo,
    fontSize: 52,
    letterSpacing: -1.5,
    marginTop: espacio.xs,
    marginBottom: espacio.s,
  },
  negativo: { color: colores.acento },
  bienvenida: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 15,
    lineHeight: 22,
    marginTop: espacio.xs,
    marginBottom: espacio.m,
  },
  sincronizar: { marginTop: espacio.s },
  // ── panel de consentimiento ──
  consent: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.s,
    gap: espacio.s,
  },
  consentTitulo: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 16, marginBottom: espacio.xs },
  consentTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20 },
  consentItem: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 14, lineHeight: 22 },
  consentNota: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12, lineHeight: 18, marginTop: espacio.xs },
  autorizar: { marginTop: espacio.m },
  cancelar: { alignItems: "center", paddingVertical: espacio.s, marginTop: espacio.xs },
  cancelarTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 14 },
  // ── resto ──
  resultado: {
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.m,
    padding: espacio.m,
    marginTop: espacio.m,
    alignItems: "center",
  },
  resultadoTexto: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 14 },
  error: { color: colores.acento, fontFamily: fuente.texto, fontSize: 13, marginTop: espacio.m, textAlign: "center" },
  par: { flexDirection: "row", gap: espacio.m, marginTop: espacio.l },
  tarjeta: {
    flex: 1,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: espacio.s,
  },
  rotuloTarjeta: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 12, letterSpacing: 1.2 },
  cifra: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 24, letterSpacing: -0.5, marginTop: espacio.s },
  pieTarjeta: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12 },
});
