/**
 * Privacidad — para qué se usan tus datos, y qué autorizaste tú.
 *
 * Es la contraparte de la pantalla del banco. Allá autorizas que Velvet LEA
 * tus movimientos; acá decides si además puede USARLOS para otra cosa. Son
 * finalidades distintas y la Ley 21.719 pide consentimiento específico para
 * cada una: un "sí" no cubre al otro.
 *
 * Tres cosas que la pantalla hace cumplir, no solo dice:
 *  · Llega apagado. Nadie queda autorizado por no haber mirado esta pantalla.
 *  · Se muestra hasta cuándo vale, porque vence y hay que renovarlo.
 *  · Revocar está al mismo alcance que aceptar: un toque, sin fricción añadida.
 */
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Nota, Pantalla } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { fechaConAnio } from "@/utils/formato";
import {
  decidirFinalidad,
  obtenerFinalidades,
  type Finalidad,
} from "@/servicios/privacidad";

function Tarjeta({
  finalidad: f,
  ocupado,
  onCambiar,
}: {
  finalidad: Finalidad;
  ocupado: boolean;
  onCambiar: (acepta: boolean) => void;
}) {
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.cabecera}>
        <View style={estilos.titulos}>
          <Text style={estilos.titulo}>{f.titulo}</Text>
          <Text style={estilos.opcional}>Opcional</Text>
        </View>
        <Switch
          value={f.consentido}
          onValueChange={onCambiar}
          disabled={ocupado}
          trackColor={{ false: colores.chip, true: colores.acento }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Text style={estilos.resumen}>{f.resumen}</Text>

      <View style={estilos.puntos}>
        {f.detalle.map((linea) => (
          <View key={linea} style={estilos.punto}>
            <Text style={estilos.vineta}>·</Text>
            <Text style={estilos.puntoTexto}>{linea}</Text>
          </View>
        ))}
      </View>

      <View style={estilos.estado}>
        {f.consentido ? (
          <Text style={estilos.vigente}>
            Autorizado{f.desde ? ` el ${fechaConAnio(f.desde)}` : ""}
            {f.vence ? ` · vence el ${fechaConAnio(f.vence)}` : ""}
          </Text>
        ) : (
          <Text style={estilos.apagado}>
            No autorizado. Tus datos no se usan para esto.
          </Text>
        )}
      </View>
    </View>
  );
}

export default function Privacidad() {
  const router = useRouter();
  const [finalidades, setFinalidades] = useState<Finalidad[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    obtenerFinalidades()
      .then(setFinalidades)
      .catch((e) => setError(e.message));
  }, []);

  useFocusEffect(cargar);

  async function cambiar(id: string, acepta: boolean) {
    setOcupado(id);
    setError(null);
    try {
      await decidirFinalidad(id, acepta);
      setFinalidades(await obtenerFinalidades());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Pantalla titulo="Privacidad" onAtras={() => router.back()}>
      <Text style={estilos.entrada}>
        Autorizar que Velvet lea tus movimientos no significa que pueda usarlos para otra cosa.
        Acá decides, por separado, para qué más.
      </Text>

      {finalidades === null && !error ? (
        <ActivityIndicator color={colores.acento} style={estilos.cargando} />
      ) : null}

      {finalidades?.map((f) => (
        <View key={f.id}>
          <Tarjeta
            finalidad={f}
            ocupado={ocupado === f.id}
            onCambiar={(acepta) => cambiar(f.id, acepta)}
          />
          {f.textoDesactualizado ? (
            <Text style={estilos.desactualizado}>
              Cambiamos lo que hacemos con estos datos. Tu autorización anterior no cubre lo nuevo:
              revísalo y decide de nuevo.
            </Text>
          ) : null}
        </View>
      ))}

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Nota>
        Estas decisiones quedan registradas con su fecha, y al revocar también queda registrado
        cuándo. Es el registro de actividades de tratamiento que exige la Ley 21.719.
      </Nota>

      <Pressable onPress={() => router.back()} style={estilos.volver}>
        <Text style={estilos.volverTexto}>Volver a Cuentas</Text>
      </Pressable>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  entrada: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: espacio.m,
  },
  cargando: { marginTop: espacio.xl },
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  cabecera: { flexDirection: "row", alignItems: "flex-start", gap: espacio.m },
  titulos: { flex: 1, gap: 2 },
  titulo: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17 },
  opcional: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 11, letterSpacing: 1 },
  resumen: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 15,
    lineHeight: 22,
    marginTop: espacio.m,
  },
  puntos: { marginTop: espacio.m, gap: espacio.s },
  punto: { flexDirection: "row", gap: espacio.s },
  vineta: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 14 },
  puntoTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13.5, lineHeight: 20, flex: 1 },
  estado: {
    marginTop: espacio.l,
    paddingTop: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
  },
  vigente: { color: colores.ok, fontFamily: fuente.textoMedio, fontSize: 13.5 },
  apagado: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13.5 },
  desactualizado: {
    color: colores.alerta,
    fontFamily: fuente.texto,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: espacio.s,
  },
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.m },
  volver: { marginTop: espacio.l, paddingVertical: espacio.m, alignItems: "center" },
  volverTexto: { color: colores.acento, fontFamily: fuente.textoFuerte, fontSize: 16 },
});
