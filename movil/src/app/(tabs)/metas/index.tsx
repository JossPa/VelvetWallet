/**
 * Metas — la tercera pregunta del producto: "¿cuándo voy a poder comprarlo?".
 *
 * Cada meta muestra lo reunido y, debajo, la respuesta del motor Monte Carlo
 * (RF-24): no "te faltan 8 meses" sino "8 meses con 80% de probabilidad". La
 * diferencia no es de redacción. El excedente de una persona cambia todos los
 * meses, y un plazo único daría una certeza que nadie tiene.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import type { Meta } from "@/modelo/tipos";
import { listarMetas } from "@/servicios/metas";
import { pesos } from "@/utils/formato";
import { describirProyeccion, faltaPara } from "@/utils/metas";

export default function Metas() {
  const router = useRouter();
  const [metas, setMetas] = useState<Meta[] | null>(null);
  const [mesesObservados, setMesesObservados] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Se recarga al volver a la pantalla: el detalle pudo cambiar un monto, y
  // la proyección se recalcula en el servidor con cada lectura.
  useFocusEffect(
    useCallback(() => {
      listarMetas()
        .then((r) => {
          setMetas(r.metas);
          setMesesObservados(r.mesesObservados);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, []),
  );

  if (error) {
    return (
      <Pantalla titulo="Metas">
        <Nota>{error}</Nota>
      </Pantalla>
    );
  }

  if (metas === null) {
    return (
      <Pantalla titulo="Metas">
        <ActivityIndicator color={colores.acento} style={estilos.cargando} />
      </Pantalla>
    );
  }

  return (
    <Pantalla
      titulo="Metas"
      etiqueta={metas.length > 0 ? `${metas.length} ${metas.length === 1 ? "activa" : "activas"}` : undefined}
    >
      {metas.length === 0 ? (
        <View style={estilos.vacio}>
          <Ionicons name="flag-outline" size={34} color={colores.texto3} />
          <Text style={estilos.vacioTitulo}>Todavía no tienes metas</Text>
          <Text style={estilos.vacioTexto}>
            Anota algo que quieras comprar y Velvet calcula, con tu propio historial de gastos, en
            cuánto tiempo lo alcanzas y con qué probabilidad.
          </Text>
        </View>
      ) : (
        metas.map((m) => (
          <TarjetaMeta
            key={m.id}
            meta={m}
            onPress={() => router.push({ pathname: "/metas/[id]", params: { id: m.id } })}
          />
        ))
      )}

      <Boton titulo="Nueva meta" onPress={() => router.push("/metas/nueva")} style={estilos.nueva} />

      {metas.length > 0 ? (
        <>
          <Seccion titulo="De dónde sale el cálculo" />
          <Nota>
            La proyección simula miles de futuros posibles usando los {mesesObservados} meses que ya
            llevas registrados, tomados en distinto orden. No supone que todos los meses te sobre lo
            mismo, porque nunca pasa.
          </Nota>
        </>
      ) : null}
    </Pantalla>
  );
}

function TarjetaMeta({ meta, onPress }: { meta: Meta; onPress: () => void }) {
  const resumen = describirProyeccion(meta);
  const avance = Math.round(meta.avance * 100);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [estilos.tarjeta, pressed && estilos.presionada]}
    >
      <View style={estilos.cabecera}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {meta.nombre}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colores.texto3} />
      </View>

      <Text style={estilos.montos}>
        <Text style={estilos.ahorrado}>{pesos(meta.montoAhorrado)}</Text>
        <Text style={estilos.objetivo}>{`  de ${pesos(meta.montoObjetivo)}`}</Text>
      </Text>

      <View style={estilos.pista}>
        <View style={[estilos.avance, { width: `${Math.min(avance, 100)}%` }]} />
      </View>

      <View style={estilos.piePorcentaje}>
        <Text style={estilos.porcentaje}>{avance}%</Text>
        <Text style={estilos.falta}>
          {faltaPara(meta) > 0 ? `faltan ${pesos(faltaPara(meta))}` : "completa"}
        </Text>
      </View>

      <View style={estilos.proyeccion}>
        <Text style={[estilos.titular, !resumen.hayRespuesta && estilos.titularApagado]}>
          {resumen.titular}
        </Text>
        {resumen.detalle ? <Text style={estilos.detalle}>{resumen.detalle}</Text> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cargando: { marginTop: espacio.xl },
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  presionada: { opacity: 0.8 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.m },
  nombre: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 18, flexShrink: 1 },
  montos: { marginTop: espacio.m },
  ahorrado: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 24, letterSpacing: -0.4 },
  objetivo: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 15 },
  pista: {
    height: 6,
    backgroundColor: colores.chip,
    borderRadius: 3,
    marginTop: espacio.m,
    overflow: "hidden",
  },
  avance: { height: "100%", backgroundColor: colores.acento, borderRadius: 3 },
  piePorcentaje: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  porcentaje: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 12 },
  falta: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12 },
  proyeccion: {
    marginTop: espacio.l,
    paddingTop: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
    gap: 3,
  },
  titular: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15 },
  titularApagado: { color: colores.alerta },
  detalle: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19 },
  nueva: { marginTop: espacio.l },
  vacio: { alignItems: "center", gap: espacio.m, paddingVertical: espacio.xl },
  vacioTitulo: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 18 },
  vacioTexto: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
