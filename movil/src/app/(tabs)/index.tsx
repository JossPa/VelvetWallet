/**
 * Inicio — responde la primera pregunta del producto:
 * "¿Cuánto tengo disponible este mes?"
 *
 * Se muestra lo que ya funciona con datos reales del backend: disponible,
 * ingresos y gastos del mes, en qué se va la plata (por categoría) y cómo
 * cambió respecto al mes anterior.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Comparacion } from "@/components/Comparacion";
import { GraficoCategorias } from "@/components/GraficoCategorias";
import { GraficoMeses } from "@/components/GraficoMeses";
import { Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { useMovimientos, type VueltaDelBanco } from "@/datos/MovimientosContexto";
import { ErrorSincronizacion } from "@/servicios/sincronizacion";
import { claveMes, nombreMes, pesos } from "@/utils/formato";
import {
  compararConMesAnterior,
  gastoUltimosMeses,
  mesAnterior,
  promedioMensual,
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

/** Mensaje para el usuario según cómo volvió del sitio del banco. */
function mensajeDeVuelta(v: VueltaDelBanco): string {
  if (v.banco === "rechazado") return "Rechazaste el acceso en tu banco. No se compartió nada.";
  if (v.motivo === "otro_cliente") {
    return "Este banco ya está vinculado a otro RUT en tu cuenta. Desvincúlalo antes de autorizar con otro.";
  }
  if (v.motivo === "expirado") {
    return "La autorización venció o ya se había usado. Vuelve a intentarlo.";
  }
  return "No se pudo completar la vinculación con tu banco. Intenta de nuevo.";
}

/**
 * Panel de autorización: explica qué se pide y manda al usuario al SITIO DE SU
 * BANCO. Allá inicia sesión con su RUT y su clave y aprueba; Velvet no ve ni
 * guarda esos datos (OAuth del SFA). El banco lo devuelve a la app.
 */
function PanelAutorizacion({
  motivo,
  ocupado,
  onIrAlBanco,
  onCancelar,
}: {
  motivo?: string | null;
  ocupado: boolean;
  onIrAlBanco: () => void;
  onCancelar?: () => void;
}) {
  return (
    <View style={estilos.consent}>
      <Text style={estilos.consentTitulo}>Autorización de acceso</Text>
      {motivo ? <Text style={estilos.consentMotivo}>{motivo}</Text> : null}
      <Text style={estilos.consentTexto}>
        Velvet Wallet solicita tu permiso para leer, en tu banco:
      </Text>
      <Text style={estilos.consentItem}>•  Tus cuentas y saldos</Text>
      <Text style={estilos.consentItem}>•  Tus movimientos</Text>

      <Text style={estilos.consentNota}>
        Te llevaremos al sitio de Banco Simulado SFA. Inicias sesión allá con tu RUT y tu clave y
        decides si autorizas. Velvet nunca ve tu clave, y puedes revocar el acceso cuando quieras.
      </Text>

      <Boton
        titulo={ocupado ? "Abriendo tu banco…" : "Ir a Banco Simulado SFA"}
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

export default function Inicio() {
  const router = useRouter();
  const { movimientos, sincronizando, sincronizar, irAlBanco, completarVinculacion, desvincular, clienteBanco, error } =
    useMovimientos();
  // Vuelta desde el sitio del banco (web): ?banco=vinculado|rechazado|error&motivo=…
  const parametros = useLocalSearchParams<{ banco?: string; motivo?: string }>();
  const vueltaProcesada = useRef(false);
  const [abriendoBanco, setAbriendoBanco] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [solicitando, setSolicitando] = useState(false);
  // Cuando el permiso guardado ya no sirve, hay que volver a autorizar en el banco.
  const [reautorizar, setReautorizar] = useState<string | null>(null);
  const [confirmarDesvincular, setConfirmarDesvincular] = useState(false);
  // Mes que mira el panel. null = el más reciente con datos; cambia al tocar
  // una barra del gráfico de meses.
  const [mesElegido, setMesElegido] = useState<string | null>(null);

  async function alDesvincular() {
    try {
      await desvincular();
    } catch {
      // El mensaje ya quedó en `error`.
    } finally {
      setConfirmarDesvincular(false);
    }
  }

  async function alSincronizar() {
    setResultado(null);
    try {
      setResultado(describirResultado(await sincronizar()));
    } catch (e) {
      if (e instanceof ErrorSincronizacion && e.codigo === "reautorizar") {
        setReautorizar(e.message);
      }
      // El mensaje ya quedó en `error`; se muestra abajo del botón.
    }
  }

  /** Cómo volvió el usuario del banco: si autorizó, se traen sus datos. */
  async function procesarVuelta(v: VueltaDelBanco) {
    setReautorizar(null);
    setSolicitando(false);
    if (v.banco !== "vinculado") {
      setAviso(mensajeDeVuelta(v));
      return;
    }
    setAviso(null);
    try {
      await completarVinculacion();
    } catch {
      // El mensaje ya quedó en `error`.
    }
  }

  async function alIrAlBanco() {
    setAviso(null);
    setAbriendoBanco(true);
    try {
      const vuelta = await irAlBanco(); // en web la página se va al banco
      if (vuelta) await procesarVuelta(vuelta);
    } catch {
      // El mensaje ya quedó en `error`.
    } finally {
      setAbriendoBanco(false);
    }
  }

  // En web el banco devuelve al usuario a esta pantalla con ?banco=…: se
  // procesa una sola vez y se limpia la URL.
  useEffect(() => {
    // Solo web: en el celular la vuelta llega como resultado de irAlBanco().
    if (Platform.OS !== "web" || !parametros.banco || vueltaProcesada.current) return;
    vueltaProcesada.current = true;
    const vuelta: VueltaDelBanco = { banco: String(parametros.banco), motivo: parametros.motivo };
    router.replace("/");
    procesarVuelta(vuelta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros.banco]);

  // Usuario sin movimientos todavía (p. ej. recién registrado): aún no vinculó
  // ningún banco. Aquí PIDE el permiso explícitamente — no se conecta solo.
  if (movimientos.length === 0) {
    return (
      <Pantalla titulo="Velvet Wallet" marca>
        <Text style={estilos.rotulo}>CONECTA TU PRIMER BANCO</Text>
        <Text style={estilos.bienvenida}>
          Aún no has vinculado ninguna cuenta. Conecta tu banco para traer tus movimientos.
        </Text>

        {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}

        {sincronizando && !solicitando && !reautorizar ? (
          <Boton titulo="Trayendo tus datos del banco…" onPress={() => {}} cargando style={estilos.sincronizar} />
        ) : !solicitando && !reautorizar ? (
          <Boton
            titulo="Conectar mi banco"
            onPress={() => setSolicitando(true)}
            style={estilos.sincronizar}
          />
        ) : (
          <PanelAutorizacion
            motivo={reautorizar}
            ocupado={abriendoBanco || sincronizando}
            onIrAlBanco={alIrAlBanco}
            onCancelar={() => {
              setSolicitando(false);
              setReautorizar(null);
            }}
          />
        )}

        {error ? <Text style={estilos.error}>{error}</Text> : null}
      </Pantalla>
    );
  }

  const mes = mesElegido ?? claveMes(movimientos[0].fecha);
  const resumen = resumenDelMes(movimientos, mes);
  const reparto = repartoPorCategoria(movimientos, mes);
  const comparacion = compararConMesAnterior(movimientos, mes);

  // Serie de los últimos seis meses. El gráfico la muestra y, al tocar una
  // barra, el resto del panel se mueve a ese mes.
  const serie = gastoUltimosMeses(movimientos, 6);
  const promedio = promedioMensual(serie);
  const mesesDelPeriodo = new Set(serie.map((g) => g.mes));
  const repartoPeriodo = repartoPorCategoria(movimientos, mesesDelPeriodo);

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
      {/* Siempre visible con datos: también para vínculos hechos antes de que
          se guardara el cliente del banco (sin nombre), para poder cambiarlo. */}
      <View style={estilos.vinculoFila}>
        <Text style={estilos.vinculo}>
          {clienteBanco?.nombre
            ? `Banco vinculado como ${clienteBanco.nombre} · ${clienteBanco.rut}`
            : "Banco vinculado"}
        </Text>
        {!confirmarDesvincular ? (
          <Pressable onPress={() => setConfirmarDesvincular(true)} hitSlop={8}>
            <Text style={estilos.vinculoAccion}>Desvincular</Text>
          </Pressable>
        ) : null}
      </View>
      {confirmarDesvincular ? (
        <View style={estilos.confirmar}>
          <Text style={estilos.confirmarTexto}>
            Se revoca el permiso y se borran de Velvet tus cuentas y movimientos de este banco.
          </Text>
          <View style={estilos.confirmarAcciones}>
            <Pressable onPress={() => setConfirmarDesvincular(false)} style={estilos.cancelar}>
              <Text style={estilos.cancelarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={alDesvincular} style={estilos.cancelar}>
              <Text style={estilos.confirmarSi}>Sí, desvincular</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {reautorizar ? (
        <PanelAutorizacion
          motivo={reautorizar}
          ocupado={abriendoBanco || sincronizando}
          onIrAlBanco={alIrAlBanco}
          onCancelar={() => setReautorizar(null)}
        />
      ) : null}

      {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}

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

      <Seccion titulo="Gasto de los últimos meses" />
      <GraficoMeses
        serie={serie}
        promedio={promedio}
        seleccionado={mes}
        onSeleccionar={setMesElegido}
      />

      {repartoPeriodo.porciones.length > 0 ? (
        <>
          <Seccion titulo="En qué se fue en esos meses" />
          <GraficoCategorias
            porciones={repartoPeriodo.porciones}
            total={repartoPeriodo.total}
          />
        </>
      ) : null}

      {reparto.porciones.length > 0 ? (
        <>
          <Seccion titulo={`En qué se te va · ${nombreMes(mes)}`} />
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
  aviso: {
    color: colores.texto,
    backgroundColor: colores.alertaSuave,
    borderRadius: radio.m,
    padding: espacio.m,
    marginTop: espacio.m,
    fontFamily: fuente.texto,
    fontSize: 13,
    lineHeight: 19,
  },
  consentMotivo: { color: colores.alerta, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19 },
  vinculoFila: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: espacio.s, marginTop: espacio.s, flexWrap: "wrap" },
  vinculo: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12, textAlign: "center" },
  vinculoAccion: { color: colores.acento, fontFamily: fuente.textoFuerte, fontSize: 12 },
  confirmar: { backgroundColor: colores.alertaSuave, borderRadius: radio.m, padding: espacio.m, marginTop: espacio.s, gap: espacio.xs },
  confirmarTexto: { color: colores.texto, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19 },
  confirmarAcciones: { flexDirection: "row", justifyContent: "flex-end", gap: espacio.l },
  confirmarSi: { color: colores.acento, fontFamily: fuente.textoFuerte, fontSize: 14 },
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
