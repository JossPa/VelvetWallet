/**
 * Suscripciones y gastos fijos detectados.
 *
 * Responde una pregunta que el panel no contesta: cuánto del sueldo ya está
 * comprometido antes de gastar nada. Son los cobros que se repiten sin que
 * nadie los mire —el gimnasio, el streaming, la luz— y que por eso se olvidan.
 *
 * Cada una llega como **propuesta** del detector, no como un hecho. El
 * algoritmo acierta casi siempre, pero marcar como gasto fijo algo que no lo
 * es desordena el presupuesto de una persona, así que la última palabra es
 * suya: confirma o descarta, y esa decisión se respeta en las
 * sincronizaciones siguientes.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AvatarComercio } from "@/components/AvatarComercio";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { fechaConAnio, pesos } from "@/utils/formato";
import {
  decidirSuscripcion,
  obtenerSuscripciones,
  type Suscripcion,
} from "@/servicios/suscripciones";

const CADA: Record<string, string> = {
  semanal: "cada semana",
  quincenal: "cada quincena",
  mensual: "cada mes",
  bimestral: "cada dos meses",
  trimestral: "cada tres meses",
  anual: "una vez al año",
};

function Tarjeta({
  s,
  ocupada,
  onDecidir,
}: {
  s: Suscripcion;
  ocupada: boolean;
  onDecidir: (estado: "confirmada" | "descartada") => void;
}) {
  const descartada = s.estado === "descartada";

  return (
    <View style={[estilos.tarjeta, descartada && estilos.tarjetaApagada]}>
      <View style={estilos.cabecera}>
        <AvatarComercio nombre={s.nombre} tamano={38} />
        <View style={estilos.identidad}>
          <Text style={estilos.nombre} numberOfLines={1}>
            {s.nombre}
          </Text>
          <Text style={estilos.periodo}>
            {CADA[s.periodicidad ?? ""] ?? "periodicidad desconocida"}
            {s.cobros ? ` · ${s.cobros} cobros` : ""}
          </Text>
        </View>
        <Text style={estilos.monto}>{s.montoEsperado !== null ? pesos(s.montoEsperado) : "—"}</Text>
      </View>

      {s.proximaFecha && !descartada ? (
        <Text style={estilos.proxima}>Próximo cobro estimado: {fechaConAnio(s.proximaFecha)}</Text>
      ) : null}

      {s.estado === "detectada" ? (
        <View style={estilos.decidir}>
          <Pressable
            onPress={() => onDecidir("confirmada")}
            disabled={ocupada}
            style={({ pressed }) => [estilos.boton, estilos.si, pressed && estilos.presionado]}
          >
            <Ionicons name="checkmark" size={16} color={colores.ok} />
            <Text style={[estilos.botonTexto, { color: colores.ok }]}>Sí, es fija</Text>
          </Pressable>
          <Pressable
            onPress={() => onDecidir("descartada")}
            disabled={ocupada}
            style={({ pressed }) => [estilos.boton, pressed && estilos.presionado]}
          >
            <Ionicons name="close" size={16} color={colores.texto3} />
            <Text style={estilos.botonTexto}>No lo es</Text>
          </Pressable>
        </View>
      ) : (
        <View style={estilos.resuelta}>
          <Ionicons
            name={descartada ? "close-circle-outline" : "checkmark-circle-outline"}
            size={15}
            color={descartada ? colores.texto3 : colores.ok}
          />
          <Text style={[estilos.resueltaTexto, !descartada && { color: colores.ok }]}>
            {descartada ? "La descartaste: no cuenta como gasto fijo" : "Confirmada por ti"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function Suscripciones() {
  const router = useRouter();
  const [datos, setDatos] = useState<{
    suscripciones: Suscripcion[];
    comprometidoAlMes: number;
    porRevisar: number;
  } | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    obtenerSuscripciones().then(setDatos).catch((e) => setError(e.message));
  }, []);

  useFocusEffect(cargar);

  async function decidir(id: string, estado: "confirmada" | "descartada") {
    setOcupada(id);
    try {
      await decidirSuscripcion(id, estado);
      setDatos(await obtenerSuscripciones());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupada(null);
    }
  }

  if (error) {
    return (
      <Pantalla titulo="Gastos fijos" onAtras={() => router.back()}>
        <Nota>{error}</Nota>
      </Pantalla>
    );
  }

  if (!datos) {
    return (
      <Pantalla titulo="Gastos fijos" onAtras={() => router.back()}>
        <ActivityIndicator color={colores.acento} style={estilos.cargando} />
      </Pantalla>
    );
  }

  const porRevisar = datos.suscripciones.filter((s) => s.estado === "detectada");
  const resueltas = datos.suscripciones.filter((s) => s.estado !== "detectada");

  return (
    <Pantalla titulo="Gastos fijos" onAtras={() => router.back()}>
      {datos.suscripciones.length === 0 ? (
        <Nota>
          Todavía no se detectan gastos recurrentes. Hacen falta al menos tres cobros del mismo
          comercio para reconocer una periodicidad; con menos no se puede distinguir una
          suscripción de una coincidencia.
        </Nota>
      ) : (
        <>
          <View style={estilos.total}>
            <Text style={estilos.totalRotulo}>COMPROMETIDO CADA MES</Text>
            <Text style={estilos.totalMonto}>{pesos(datos.comprometidoAlMes)}</Text>
            <Text style={estilos.totalPie}>
              Esto se va solo, antes de que gastes en cualquier otra cosa.
            </Text>
          </View>

          {porRevisar.length > 0 ? (
            <>
              <Seccion titulo={`Por revisar · ${porRevisar.length}`} />
              <Text style={estilos.ayuda}>
                Detectamos estos cobros repetidos. Confirma los que de verdad sean gastos fijos.
              </Text>
              {porRevisar.map((s) => (
                <Tarjeta
                  key={s.id}
                  s={s}
                  ocupada={ocupada === s.id}
                  onDecidir={(estado) => decidir(s.id, estado)}
                />
              ))}
            </>
          ) : null}

          {resueltas.length > 0 ? (
            <>
              <Seccion titulo="Ya revisadas" />
              {resueltas.map((s) => (
                <Tarjeta
                  key={s.id}
                  s={s}
                  ocupada={ocupada === s.id}
                  onDecidir={(estado) => decidir(s.id, estado)}
                />
              ))}
            </>
          ) : null}

          <Nota>
            Un cobro se reconoce por su forma en el tiempo, no porque el monto sea idéntico: se
            tolera que cambie el precio, que la fecha se corra unos días y que el banco escriba el
            nombre distinto cada vez.
          </Nota>
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { marginTop: espacio.xl },

  total: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: 2,
  },
  totalRotulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 11, letterSpacing: 1.2 },
  totalMonto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 32, letterSpacing: -0.7 },
  totalPie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, marginTop: 2 },

  ayuda: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13.5, lineHeight: 20 },

  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  tarjetaApagada: { opacity: 0.55 },
  cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  identidad: { flex: 1, gap: 1 },
  nombre: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15.5 },
  periodo: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5 },
  monto: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 16 },
  proxima: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5, marginTop: espacio.m },

  decidir: {
    flexDirection: "row",
    gap: espacio.s,
    marginTop: espacio.l,
    paddingTop: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
  },
  boton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: espacio.xs,
    backgroundColor: colores.chip,
    borderRadius: radio.m,
    paddingVertical: espacio.m,
  },
  si: { backgroundColor: "#15291F" },
  presionado: { opacity: 0.7 },
  botonTexto: { color: colores.texto3, fontFamily: fuente.textoFuerte, fontSize: 13.5 },

  resuelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
    marginTop: espacio.m,
    paddingTop: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
  },
  resueltaTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13 },
});
