/**
 * Avisos de seguridad — notificación de brechas (Ley 21.719, RF-29).
 *
 * Cuando una vulneración afecta los datos de una persona, la ley obliga a
 * avisarle. Esta pantalla es ese aviso.
 *
 * Cómo está escrita importa tanto como que exista. Una notificación de brecha
 * redactada para protegerse legalmente no informa a nadie: se lee en
 * diagonal y se cierra. Por eso cada aviso responde cuatro preguntas en el
 * orden en que la persona se las hace —qué pasó, qué datos míos, qué hicieron
 * ustedes, qué hago yo— y nunca empieza con una disculpa.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Nota, Pantalla } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { fechaConAnio, hora } from "@/utils/formato";
import {
  marcarIncidenteVisto,
  obtenerIncidentes,
  type Incidente,
} from "@/servicios/incidentes";

const GRAVEDAD: Record<string, { texto: string; color: string }> = {
  alta: { texto: "Gravedad alta", color: colores.acento },
  media: { texto: "Gravedad media", color: colores.alerta },
  baja: { texto: "Gravedad baja", color: colores.texto3 },
};

/** Qué puede hacer la persona. Es lo único accionable del aviso. */
const QUE_HACER = [
  "Revisa tus movimientos y avísanos si ves algo que no reconoces.",
  "Si usas la misma contraseña en otros servicios, cámbiala ahí también.",
  "Nunca te vamos a pedir tu clave del banco por correo ni por teléfono.",
];

function Bloque({ titulo, children }: { titulo: string; children: string }) {
  return (
    <View style={estilos.bloque}>
      <Text style={estilos.bloqueTitulo}>{titulo}</Text>
      <Text style={estilos.bloqueTexto}>{children}</Text>
    </View>
  );
}

function Tarjeta({ i, onVisto }: { i: Incidente; onVisto: () => void }) {
  const g = GRAVEDAD[i.gravedad] ?? GRAVEDAD.media;
  const sinLeer = i.visto === null;

  return (
    <View style={[estilos.tarjeta, sinLeer && estilos.tarjetaSinLeer]}>
      <View style={estilos.cabecera}>
        <Ionicons name="shield-outline" size={20} color={g.color} />
        <Text style={[estilos.gravedad, { color: g.color }]}>{g.texto}</Text>
        {sinLeer ? <View style={estilos.punto} /> : null}
      </View>

      <Text style={estilos.titulo}>{i.titulo}</Text>
      <Text style={estilos.cuando}>
        Detectado el {fechaConAnio(i.detectado)} a las {hora(i.detectado)}
      </Text>

      <Bloque titulo="Qué pasó">{i.descripcion}</Bloque>
      <Bloque titulo="Qué datos tuyos">{i.datosAfectados}</Bloque>
      {i.medidas ? <Bloque titulo="Qué hicimos">{i.medidas}</Bloque> : null}

      <View style={estilos.bloque}>
        <Text style={estilos.bloqueTitulo}>Qué puedes hacer tú</Text>
        {QUE_HACER.map((linea) => (
          <View key={linea} style={estilos.punteo}>
            <Text style={estilos.vineta}>·</Text>
            <Text style={estilos.punteoTexto}>{linea}</Text>
          </View>
        ))}
      </View>

      <View style={estilos.cumplimiento}>
        <Ionicons
          name={i.plazo.dentroDePlazo ? "checkmark-circle-outline" : "alert-circle-outline"}
          size={15}
          color={i.plazo.dentroDePlazo ? colores.ok : colores.alerta}
        />
        <Text style={estilos.cumplimientoTexto}>
          {i.plazo.descripcion}
          {i.autoridadAvisada ? " · Autoridad notificada" : ""}
        </Text>
      </View>

      {sinLeer ? (
        <Pressable
          onPress={onVisto}
          style={({ pressed }) => [estilos.boton, pressed && estilos.presionado]}
        >
          <Text style={estilos.botonTexto}>Entendido</Text>
        </Pressable>
      ) : (
        <Text style={estilos.leido}>Lo leíste el {fechaConAnio(i.visto!)}</Text>
      )}
    </View>
  );
}

export default function Incidentes() {
  const router = useRouter();
  const [incidentes, setIncidentes] = useState<Incidente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    obtenerIncidentes()
      .then((r) => setIncidentes(r.incidentes))
      .catch((e) => setError(e.message));
  }, []);

  useFocusEffect(cargar);

  async function marcar(id: string) {
    try {
      await marcarIncidenteVisto(id);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  if (error) {
    return (
      <Pantalla titulo="Avisos de seguridad" onAtras={() => router.back()}>
        <Nota>{error}</Nota>
      </Pantalla>
    );
  }

  if (!incidentes) {
    return (
      <Pantalla titulo="Avisos de seguridad" onAtras={() => router.back()}>
        <ActivityIndicator color={colores.acento} style={estilos.cargando} />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Avisos de seguridad" onAtras={() => router.back()}>
      {incidentes.length === 0 ? (
        <>
          <View style={estilos.tranquilo}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colores.ok} />
            <Text style={estilos.tranquiloTexto}>
              No hay incidentes de seguridad que afecten tus datos.
            </Text>
          </View>
          <Nota>
            Si alguna vez ocurre una vulneración que comprometa tu información, te lo avisamos acá
            y por correo dentro de 72 horas desde que la detectemos. Es una obligación de la Ley
            21.719, no una cortesía.
          </Nota>
        </>
      ) : (
        <>
          <Text style={estilos.entrada}>
            Te avisamos cada vez que una vulneración de seguridad afecta tus datos. Solo verás acá
            las que te afectan a ti.
          </Text>
          {incidentes.map((i) => (
            <Tarjeta key={i.id} i={i} onVisto={() => marcar(i.id)} />
          ))}
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { marginTop: espacio.xl },
  entrada: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15, lineHeight: 22 },

  tranquilo: {
    alignItems: "center",
    gap: espacio.m,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.xl,
  },
  tranquiloTexto: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  tarjetaSinLeer: { borderWidth: 1, borderColor: colores.acento },
  cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  gravedad: { fontFamily: fuente.textoFuerte, fontSize: 12.5, flex: 1 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colores.acento },
  titulo: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17, marginTop: espacio.s },
  cuando: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5, marginTop: 2 },

  bloque: { marginTop: espacio.l, gap: espacio.xs },
  bloqueTitulo: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 13.5 },
  bloqueTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 21 },
  punteo: { flexDirection: "row", gap: espacio.s },
  vineta: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 14 },
  punteoTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13.5, lineHeight: 20, flex: 1 },

  cumplimiento: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
    marginTop: espacio.l,
    paddingTop: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
  },
  cumplimientoTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5, flex: 1 },

  boton: {
    backgroundColor: colores.chip,
    borderRadius: radio.m,
    paddingVertical: espacio.m,
    alignItems: "center",
    marginTop: espacio.m,
  },
  presionado: { opacity: 0.7 },
  botonTexto: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 14.5 },
  leido: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5, marginTop: espacio.m },
});
