/**
 * Detalle de una meta: la respuesta completa del motor Monte Carlo.
 *
 * La lista da el titular; acá está lo que lo sostiene. El orden de la pantalla
 * es el orden en que se leen las preguntas:
 *
 *   1. ¿Cuánto llevo?            → progreso
 *   2. ¿Cuándo llego?            → los tres plazos y la curva
 *   3. ¿Llego a la fecha?        → solo si se propuso una
 *   4. ¿De dónde salió eso?      → el historial que alimentó la simulación
 *
 * El punto 4 no es decorado. Una cifra de probabilidad sin decir sobre qué
 * datos se calculó es exactamente el tipo de número que nadie debería creer.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Campo } from "@/components/Campo";
import { CurvaProbabilidad } from "@/components/CurvaProbabilidad";
import { Ficha } from "@/components/Ficha";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import type { Meta } from "@/modelo/tipos";
import { actualizarMeta, eliminarMeta, listarMetas } from "@/servicios/metas";
import { fechaConAnio, pesos } from "@/utils/formato";
import { describirPlazoPropuesto, describirProyeccion, faltaPara } from "@/utils/metas";

export default function DetalleMeta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abono, setAbono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const cargar = useCallback(() => {
    listarMetas()
      .then((r) => {
        const encontrada = r.metas.find((m) => m.id === id);
        if (!encontrada) setError("Esta meta ya no existe.");
        else setMeta(encontrada);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useFocusEffect(cargar);

  async function abonar() {
    const monto = Number(abono.replace(/[^\d]/g, ""));
    if (!meta || !monto) return;
    setGuardando(true);
    try {
      const actualizada = await actualizarMeta(meta.id, {
        montoAhorrado: Math.min(meta.montoAhorrado + monto, meta.montoObjetivo),
      });
      setMeta(actualizada);
      setAbono("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  /**
   * Borrar pide confirmación en la propia pantalla, no con un diálogo del
   * sistema: `Alert` no existe en web y el `confirm()` del navegador queda
   * bloqueado en varios contextos, así que el borrado se perdía en silencio.
   * Un segundo toque explícito se comporta igual en los dos lados.
   */
  async function borrar() {
    if (!meta) return;
    if (!confirmandoBorrado) {
      setConfirmandoBorrado(true);
      return;
    }
    try {
      await eliminarMeta(meta.id);
      router.replace("/metas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
      setConfirmandoBorrado(false);
    }
  }

  if (error) {
    return (
      <Pantalla titulo="Meta" onAtras={() => router.back()}>
        <Nota>{error}</Nota>
      </Pantalla>
    );
  }

  if (!meta) {
    return (
      <Pantalla titulo="Meta" onAtras={() => router.back()}>
        <ActivityIndicator color={colores.acento} style={estilos.cargando} />
      </Pantalla>
    );
  }

  const p = meta.proyeccion;
  const resumen = describirProyeccion(meta);
  const plazoPropuesto = describirPlazoPropuesto(p);
  const avance = Math.round(meta.avance * 100);

  return (
    <Pantalla titulo={meta.nombre} onAtras={() => router.back()}>
      {/* 1 · Cuánto llevo */}
      <View style={estilos.progreso}>
        <Text style={estilos.ahorrado}>{pesos(meta.montoAhorrado)}</Text>
        <Text style={estilos.objetivo}>de {pesos(meta.montoObjetivo)}</Text>
        <View style={estilos.pista}>
          <View style={[estilos.avance, { width: `${Math.min(avance, 100)}%` }]} />
        </View>
        <View style={estilos.piePorcentaje}>
          <Text style={estilos.porcentaje}>{avance}% reunido</Text>
          <Text style={estilos.falta}>
            {faltaPara(meta) > 0 ? `faltan ${pesos(faltaPara(meta))}` : "completa"}
          </Text>
        </View>
      </View>

      {/* 2 · Cuándo llego */}
      <Seccion titulo="Cuándo la alcanzas" />
      <View style={[estilos.titularCaja, !resumen.hayRespuesta && estilos.titularCajaAviso]}>
        <Text style={[estilos.titular, !resumen.hayRespuesta && estilos.titularAviso]}>
          {resumen.titular}
        </Text>
        {resumen.detalle ? <Text style={estilos.titularDetalle}>{resumen.detalle}</Text> : null}
      </View>

      {p.estado === "proyectada" ? (
        <>
          <View style={estilos.plazos}>
            <Plazo meses={p.mesesP50} probabilidad="50%" nota="optimista" />
            <Plazo meses={p.mesesP80} probabilidad="80%" nota="lo que informamos" destacado />
            <Plazo meses={p.mesesP95} probabilidad="95%" nota="casi seguro" />
          </View>
          <CurvaProbabilidad curva={p.curva} mesDestacado={p.mesesP80} />
        </>
      ) : null}

      {/* 3 · Llego a la fecha que me propuse */}
      {meta.fechaObjetivo ? (
        <>
          <Seccion titulo="El plazo que te propusiste" />
          <Ficha
            filas={[
              { etiqueta: "Te propusiste", valor: fechaConAnio(meta.fechaObjetivo) },
              ...(plazoPropuesto
                ? [{
                    etiqueta: "Probabilidad",
                    valor: `${Math.round((p.probabilidadALaFecha ?? 0) * 100)}%`,
                    destacar: (p.probabilidadALaFecha ?? 0) < 0.6,
                  }]
                : []),
            ]}
          />
          {plazoPropuesto ? <Nota>{plazoPropuesto}</Nota> : null}
        </>
      ) : null}

      {/* Abonar */}
      <Seccion titulo="Abonar a esta meta" />
      <View style={estilos.abono}>
        <View style={estilos.abonoCampo}>
          <Campo
            etiqueta="Monto"
            placeholder="50000"
            value={abono}
            onChangeText={setAbono}
            keyboardType="number-pad"
          />
        </View>
        <Pressable
          onPress={abonar}
          disabled={guardando || !abono}
          style={({ pressed }) => [
            estilos.abonoBoton,
            (guardando || !abono) && estilos.abonoInactivo,
            pressed && estilos.presionado,
          ]}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* 4 · De dónde salió */}
      <Seccion titulo="De dónde sale este cálculo" />
      <Ficha
        filas={[
          { etiqueta: "Meses de historial", valor: `${p.mesesObservados}` },
          { etiqueta: "Te sobra, mes típico", valor: pesos(p.excedenteMediano) },
          { etiqueta: "Tu peor mes", valor: pesos(p.excedentePeor) },
          { etiqueta: "Tu mejor mes", valor: pesos(p.excedenteMejor) },
          { etiqueta: "Futuros simulados", valor: p.simulaciones.toLocaleString("es-CL") },
        ]}
      />
      <Nota>
        No se divide el monto por un excedente promedio. Se simulan {p.simulaciones.toLocaleString("es-CL")}{" "}
        futuros tomando al azar meses que ya viviste, con sus meses buenos y sus meses malos, y se
        cuenta en cuántos de esos futuros alcanzas la meta. Por eso la respuesta viene con
        probabilidad y no como una fecha exacta.
      </Nota>

      <Pressable onPress={borrar} style={estilos.eliminar}>
        <Text style={estilos.eliminarTexto}>
          {confirmandoBorrado ? "Toca de nuevo para confirmar" : "Eliminar esta meta"}
        </Text>
      </Pressable>
      {confirmandoBorrado ? (
        <Pressable onPress={() => setConfirmandoBorrado(false)} style={estilos.cancelar}>
          <Text style={estilos.cancelarTexto}>Mejor no</Text>
        </Pressable>
      ) : null}
    </Pantalla>
  );
}

function Plazo({
  meses,
  probabilidad,
  nota,
  destacado,
}: {
  meses: number | null;
  probabilidad: string;
  nota: string;
  destacado?: boolean;
}) {
  return (
    <View style={[estilos.plazo, destacado && estilos.plazoDestacado]}>
      <Text style={[estilos.plazoMeses, destacado && estilos.plazoMesesDestacado]}>
        {meses === null ? "+24" : meses}
      </Text>
      <Text style={estilos.plazoUnidad}>{meses === 1 ? "mes" : "meses"}</Text>
      <Text style={[estilos.plazoProb, destacado && estilos.plazoProbDestacada]}>{probabilidad}</Text>
      <Text style={estilos.plazoNota}>{nota}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  cargando: { marginTop: espacio.xl },

  progreso: { backgroundColor: colores.tarjeta, borderRadius: radio.l, padding: espacio.l },
  ahorrado: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 34, letterSpacing: -0.8 },
  objetivo: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 15, marginTop: 2 },
  pista: { height: 8, backgroundColor: colores.chip, borderRadius: 4, marginTop: espacio.l, overflow: "hidden" },
  avance: { height: "100%", backgroundColor: colores.acento, borderRadius: 4 },
  piePorcentaje: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  porcentaje: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 13 },
  falta: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13 },

  titularCaja: {
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: 4,
  },
  titularCajaAviso: { backgroundColor: colores.alertaSuave },
  titular: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 19 },
  titularAviso: { color: colores.alerta },
  titularDetalle: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20 },

  plazos: { flexDirection: "row", gap: espacio.s, marginTop: espacio.m },
  plazo: {
    flex: 1,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    paddingVertical: espacio.m,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  plazoDestacado: { borderColor: colores.acento },
  plazoMeses: { color: colores.texto2, fontFamily: fuente.titulo, fontSize: 26, letterSpacing: -0.5 },
  plazoMesesDestacado: { color: colores.texto },
  plazoUnidad: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 11, marginTop: -2 },
  plazoProb: { color: colores.texto2, fontFamily: fuente.textoFuerte, fontSize: 13, marginTop: 6 },
  plazoProbDestacada: { color: colores.acento },
  plazoNota: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 10.5, marginTop: 1 },

  abono: { flexDirection: "row", alignItems: "flex-end", gap: espacio.s },
  abonoCampo: { flex: 1 },
  abonoBoton: {
    backgroundColor: colores.acento,
    borderRadius: radio.m,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  abonoInactivo: { opacity: 0.4 },
  presionado: { opacity: 0.85 },

  eliminar: { marginTop: espacio.xl, paddingVertical: espacio.m, alignItems: "center" },
  eliminarTexto: { color: colores.acento, fontFamily: fuente.textoFuerte, fontSize: 15 },
  cancelar: { paddingVertical: espacio.s, alignItems: "center" },
  cancelarTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 14 },
});
