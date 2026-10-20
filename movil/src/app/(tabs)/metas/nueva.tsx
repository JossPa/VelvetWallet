/**
 * Crear una meta.
 *
 * Se piden tres cosas y las dos últimas son opcionales: qué quieres, cuánto
 * cuesta, cuánto llevas y para cuándo lo quieres. Mientras menos campos
 * obligatorios, más probable es que la meta llegue a existir — y una meta que
 * no se crea no se proyecta.
 *
 * La fecha es opcional a propósito: si la pones, la proyección además responde
 * si llegas a tiempo, y esa respuesta puede ser que no.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Nota, Pantalla } from "@/components/Pantalla";
import { colores, espacio, fuente } from "@/constants/tema";
import { crearMeta } from "@/servicios/metas";
import { pesos } from "@/utils/formato";

/** "400.000" o "$400000" → 400000. Devuelve null si no hay un número válido. */
function aMonto(texto: string): number | null {
  const limpio = texto.replace(/[^\d]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Acepta "2027-02" o "2027-02-15". Devuelve la fecha ISO o null. */
function aFecha(texto: string): string | null {
  const t = texto.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

export default function NuevaMeta() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [ahorrado, setAhorrado] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoObjetivo = aMonto(objetivo);
  const montoAhorrado = ahorrado.trim() === "" ? 0 : aMonto(ahorrado);
  const fechaObjetivo = fecha.trim() === "" ? null : aFecha(fecha);

  const errorFecha = fecha.trim() !== "" && fechaObjetivo === null ? "Escríbela como 2027-02." : null;
  const errorAhorrado =
    montoAhorrado !== null && montoObjetivo !== null && montoAhorrado > montoObjetivo
      ? "No puede ser más que el objetivo."
      : null;

  const listo =
    nombre.trim().length > 0 &&
    montoObjetivo !== null &&
    montoAhorrado !== null &&
    !errorFecha &&
    !errorAhorrado;

  async function guardar() {
    if (!listo) return;
    setGuardando(true);
    setError(null);
    try {
      const meta = await crearMeta({
        nombre,
        montoObjetivo: montoObjetivo!,
        montoAhorrado: montoAhorrado!,
        fechaObjetivo,
      });
      // Se entra directo al detalle: lo que la persona quiere ver apenas la
      // crea es la respuesta, no volver a la lista.
      router.replace({ pathname: "/metas/[id]", params: { id: meta.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la meta.");
      setGuardando(false);
    }
  }

  return (
    <Pantalla titulo="Nueva meta" onAtras={() => router.back()}>
      <View style={estilos.campos}>
        <Campo
          etiqueta="¿Qué quieres comprar?"
          placeholder="Nintendo Switch 2"
          value={nombre}
          onChangeText={setNombre}
          maxLength={120}
        />

        <View>
          <Campo
            etiqueta="¿Cuánto cuesta?"
            placeholder="400000"
            value={objetivo}
            onChangeText={setObjetivo}
            keyboardType="number-pad"
          />
          {montoObjetivo !== null ? <Text style={estilos.eco}>{pesos(montoObjetivo)}</Text> : null}
        </View>

        <Campo
          etiqueta="¿Cuánto llevas reunido? (opcional)"
          placeholder="0"
          value={ahorrado}
          onChangeText={setAhorrado}
          keyboardType="number-pad"
          error={errorAhorrado}
        />

        <Campo
          etiqueta="¿Para cuándo lo quieres? (opcional)"
          placeholder="2027-02"
          value={fecha}
          onChangeText={setFecha}
          autoCapitalize="none"
          error={errorFecha}
        />
      </View>

      <Nota>
        Si pones una fecha, la proyección además te dice con qué probabilidad llegas a tiempo. Puede
        decirte que no, y esa también es una respuesta útil.
      </Nota>

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Boton
        titulo="Crear meta"
        onPress={guardar}
        cargando={guardando}
        deshabilitado={!listo}
        style={estilos.guardar}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  campos: { gap: espacio.l },
  eco: { color: colores.texto3, fontFamily: fuente.textoMedio, fontSize: 13, marginTop: espacio.xs },
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.m },
  guardar: { marginTop: espacio.l },
});
