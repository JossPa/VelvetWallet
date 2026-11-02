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
 *
 * Pero el historial va **agrupado por finalidad**, no como tarjetas sueltas.
 * Autorizar y revocar lo mismo varias veces es normal, y cada ciclo tiene que
 * quedar registrado; mostrados uno al lado del otro, tres ciclos iguales se
 * leen como un error de duplicación en vez del historial que son. Arriba va el
 * estado de hoy y debajo, en una línea cada uno, los ciclos anteriores.
 */
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { fechaConAnio, hora } from "@/utils/formato";
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

/** ¿Las dos fechas caen el mismo día? Decide si basta con mostrar la hora. */
function mismoDia(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * Un ciclo pasado en una línea.
 *
 * Lleva la hora y no solo la fecha porque autorizar y revocar el mismo día es
 * lo más común, y sin la hora dos ciclos distintos salen escritos igual.
 */
function resumirCiclo(c: ConsentimientoTratamiento): string {
  if (!c.desde) return ESTADOS[c.estado]?.texto ?? c.estado;

  const inicio = `${fechaConAnio(c.desde)}, ${hora(c.desde)}`;
  if (c.revocado) {
    return mismoDia(c.desde, c.revocado)
      ? `${inicio} · revocado a las ${hora(c.revocado)}`
      : `${inicio} · revocado el ${fechaConAnio(c.revocado)}`;
  }
  if (c.estado === "expirado" && c.vence) return `${inicio} · venció el ${fechaConAnio(c.vence)}`;
  return inicio;
}

/**
 * Agrupa los consentimientos de una misma finalidad en un solo bloque.
 *
 * El primero es el que manda: lo vigente si lo hay, y si no, el más reciente.
 * El orden entre finalidades es el que trajo el servidor, para no reordenar la
 * pantalla sola cada vez que alguien cambia una.
 */
function agruparPorFinalidad(filas: ConsentimientoTratamiento[]) {
  const grupos = new Map<string, ConsentimientoTratamiento[]>();
  for (const f of filas) {
    const ciclos = grupos.get(f.finalidad);
    if (ciclos) ciclos.push(f);
    else grupos.set(f.finalidad, [f]);
  }

  return [...grupos.entries()].map(([finalidad, ciclos]) => {
    const orden = [...ciclos].sort((a, b) => {
      const aVigente = a.estado === "vigente";
      const bVigente = b.estado === "vigente";
      if (aVigente !== bVigente) return aVigente ? -1 : 1;
      return (b.desde ?? "").localeCompare(a.desde ?? "");
    });
    return { finalidad, actual: orden[0], anteriores: orden.slice(1) };
  });
}

function Tarjeta({
  titulo,
  estado,
  lineas,
  puntos,
  anteriores,
}: {
  titulo: string;
  estado: string;
  lineas: string[];
  puntos?: string[];
  /** Ciclos previos de la misma autorización, del más nuevo al más viejo. */
  anteriores?: string[];
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

      {anteriores && anteriores.length > 0 ? (
        <View style={estilos.antes}>
          <Text style={estilos.antesRotulo}>
            {anteriores.length === 1 ? "ANTES" : `ANTES · ${anteriores.length} VECES`}
          </Text>
          {/* La posición es la clave: dos ciclos del mismo día pueden dar el
              mismo texto, y el texto no sirve para distinguirlos. */}
          {anteriores.map((a, i) => (
            <Text key={i} style={estilos.linea}>
              {a}
            </Text>
          ))}
        </View>
      ) : null}
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
        agruparPorFinalidad(datos.tratamiento).map(({ finalidad, actual, anteriores }) => (
          <Tarjeta
            key={finalidad}
            titulo={actual.titulo}
            estado={actual.estado}
            lineas={[
              actual.desde ? `Autorizado el ${fechaConAnio(actual.desde)}` : "",
              actual.revocado
                ? `Revocado el ${fechaConAnio(actual.revocado)}`
                : actual.vence
                  ? `Vence el ${fechaConAnio(actual.vence)}`
                  : "",
            ].filter(Boolean)}
            anteriores={anteriores.map(resumirCiclo)}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
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
  antes: {
    marginTop: espacio.m,
    paddingTop: espacio.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
  },
  antesRotulo: {
    color: colores.texto3,
    fontFamily: fuente.tituloMedio,
    fontSize: 10,
    letterSpacing: 1.1,
    marginTop: espacio.xs,
  },
});
