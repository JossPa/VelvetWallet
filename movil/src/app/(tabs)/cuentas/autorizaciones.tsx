/**
 * Qué autorizaste y por cuánto tiempo.
 *
 * Reúne los dos permisos que la ley trata por separado, porque desde fuera se
 * viven como una sola pregunta: el acceso que le diste a una institución para
 * entregarnos tus datos, y las finalidades para las que autorizaste usarlos.
 *
 * Se muestran también los revocados. Un consentimiento que caducó o que la
 * persona retiró es parte de su historial y tiene derecho a verlo: si solo se
 * mostrara lo vigente, no habría forma de comprobar que la revocación ocurrió.
 */
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { fechaConAnio } from "@/utils/formato";
import {
  obtenerConsentimientos,
  type ConsentimientoBancario,
  type ConsentimientoTratamiento,
} from "@/servicios/privacidad";

const ESTADOS: Record<string, { texto: string; color: string }> = {
  vigente: { texto: "Vigente", color: colores.ok },
  activa: { texto: "Vigente", color: colores.ok },
  expirado: { texto: "Venció", color: colores.alerta },
  revocado: { texto: "Lo revocaste", color: colores.texto3 },
  revocada: { texto: "Lo revocaste", color: colores.texto3 },
};

function Insignia({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { texto: estado, color: colores.texto3 };
  return <Text style={[estilos.insignia, { color: e.color }]}>{e.texto}</Text>;
}

function Tarjeta({
  titulo,
  estado,
  lineas,
  puntos,
}: {
  titulo: string;
  estado: string;
  lineas: string[];
  puntos?: string[];
}) {
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo} numberOfLines={2}>
          {titulo}
        </Text>
        <Insignia estado={estado} />
      </View>

      {puntos && puntos.length > 0 ? (
        <View style={estilos.puntos}>
          {puntos.map((p) => (
            <View key={p} style={estilos.punto}>
              <Text style={estilos.vineta}>·</Text>
              <Text style={estilos.puntoTexto}>{p}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {lineas.map((l) => (
        <Text key={l} style={estilos.linea}>
          {l}
        </Text>
      ))}
    </View>
  );
}

export default function Autorizaciones() {
  const router = useRouter();
  const [datos, setDatos] = useState<{
    bancarios: ConsentimientoBancario[];
    tratamiento: ConsentimientoTratamiento[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      obtenerConsentimientos().then(setDatos).catch((e) => setError(e.message));
    }, []),
  );

  if (error) {
    return (
      <Pantalla titulo="Autorizaciones" onAtras={() => router.back()}>
        <Nota>{error}</Nota>
      </Pantalla>
    );
  }

  if (!datos) {
    return (
      <Pantalla titulo="Autorizaciones" onAtras={() => router.back()}>
        <ActivityIndicator color={colores.acento} style={estilos.cargando} />
      </Pantalla>
    );
  }

  const vigentes =
    datos.bancarios.filter((b) => b.estado === "vigente").length +
    datos.tratamiento.filter((t) => t.estado === "vigente").length;

  return (
    <Pantalla
      titulo="Autorizaciones"
      etiqueta={`${vigentes} vigente${vigentes === 1 ? "" : "s"}`}
      onAtras={() => router.back()}
    >
      <Text style={estilos.entrada}>
        Todo lo que autorizaste, con su fecha y hasta cuándo vale. Se incluye lo que ya revocaste o
        venció, porque también es parte de tu historial.
      </Text>

      <Seccion titulo="Acceso a tus bancos" />
      {datos.bancarios.length === 0 ? (
        <Nota>No has vinculado ninguna institución todavía.</Nota>
      ) : (
        datos.bancarios.map((b) => (
          <Tarjeta
            key={b.id}
            titulo={b.institucion}
            estado={b.estado}
            puntos={b.permisos}
            lineas={[
              b.desde ? `Autorizado el ${fechaConAnio(b.desde)}` : "",
              b.vence ? `Vence el ${fechaConAnio(b.vence)}` : "Sin fecha de vencimiento",
            ].filter(Boolean)}
          />
        ))
      )}

      <Seccion titulo="Uso de tus datos" />
      {datos.tratamiento.length === 0 ? (
        <Nota>
          No has autorizado ninguna finalidad de uso. Tus datos solo se usan para mostrártelos a ti.
        </Nota>
      ) : (
        datos.tratamiento.map((t, i) => (
          <Tarjeta
            key={`${t.finalidad}-${t.desde ?? i}`}
            titulo={t.titulo}
            estado={t.estado}
            lineas={[
              t.desde ? `Autorizado el ${fechaConAnio(t.desde)}` : "",
              t.revocado
                ? `Revocado el ${fechaConAnio(t.revocado)}`
                : t.vence
                  ? `Vence el ${fechaConAnio(t.vence)}`
                  : "",
            ].filter(Boolean)}
          />
        ))
      )}

      <Nota>
        Puedes revocar cualquiera de estas autorizaciones cuando quieras y sin costo. El acceso a un
        banco se retira desde Cuentas; el uso de tus datos, desde "Para qué usamos tus datos".
      </Nota>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { marginTop: espacio.xl },
  entrada: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 15,
    lineHeight: 22,
  },
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  cabecera: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: espacio.m },
  titulo: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17, flexShrink: 1 },
  insignia: { fontFamily: fuente.textoFuerte, fontSize: 12.5 },
  puntos: { marginTop: espacio.m, gap: espacio.xs },
  punto: { flexDirection: "row", gap: espacio.s },
  vineta: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 14 },
  puntoTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, flex: 1 },
  linea: {
    color: colores.texto3,
    fontFamily: fuente.texto,
    fontSize: 13,
    marginTop: espacio.s,
  },
});
