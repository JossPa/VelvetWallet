/**
 * Por revisar — los movimientos que el sistema no supo clasificar.
 *
 * Es la contraparte de la abstención: el clasificador prefiere decir "no sé"
 * antes que inventar una categoría, y acá el usuario resuelve esos casos en
 * lote. Cada corrección es, además, un ejemplo etiquetado que alimenta el
 * reentrenamiento del modelo (bloque E6).
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Nota, Pantalla } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { useMovimientos } from "@/datos/MovimientosContexto";
import type { Movimiento } from "@/modelo/tipos";
import { fechaCorta, pesos } from "@/utils/formato";
import {
  categoriasEnUso,
  coberturaAutomatica,
  sugerirCategorias,
  type Sugerencia,
} from "@/utils/sugerencias";

function Tarjeta({
  movimiento: m,
  sugerencia,
  todas,
  onElegir,
}: {
  movimiento: Movimiento;
  sugerencia: Sugerencia;
  todas: string[];
  onElegir: (categoria: string) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const sugeridas = sugerencia.categorias;
  // Al desplegar "Otra…", las sugeridas ya están arriba: no se repiten.
  const opciones = verTodas ? todas.filter((c) => !sugeridas.includes(c)) : [];

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.encabezado}>
        <Text style={estilos.glosa} numberOfLines={1}>{m.glosaOriginal}</Text>
        <Text style={estilos.monto}>{pesos(Math.abs(m.monto))}</Text>
      </View>
      <Text style={estilos.origen}>
        {fechaCorta(m.fecha)} · {m.institucion}
      </Text>

      <Text style={estilos.pregunta}>
        {sugerencia.porRegla ? "¿EN QUÉ CATEGORÍA VA?" : "NO RECONOCIMOS EL COMERCIO"}
      </Text>
      {!sugerencia.porRegla ? (
        <Text style={estilos.aclaracion}>Estas son las categorías que más usas.</Text>
      ) : null}

      <View style={estilos.opciones}>
        {sugeridas.map((categoria, i) => (
          <Pressable
            key={categoria}
            onPress={() => onElegir(categoria)}
            style={({ pressed }) => [
              estilos.chip,
              // Solo se destaca si una regla reconoció la glosa. Si no
              // sabemos, todas las opciones pesan igual: no presentamos una
              // suposición como si fuera una certeza.
              i === 0 && sugerencia.porRegla && estilos.chipPrincipal,
              pressed && estilos.presionado,
            ]}
          >
            <Text
              style={[
                estilos.chipTexto,
                i === 0 && sugerencia.porRegla && estilos.chipTextoPrincipal,
              ]}
            >
              {categoria}
            </Text>
          </Pressable>
        ))}

        {!verTodas ? (
          <Pressable
            onPress={() => setVerTodas(true)}
            style={({ pressed }) => [estilos.chip, pressed && estilos.presionado]}
          >
            <Text style={estilos.chipTexto}>Otra…</Text>
          </Pressable>
        ) : (
          opciones.map((categoria) => (
            <Pressable
              key={categoria}
              onPress={() => onElegir(categoria)}
              style={({ pressed }) => [estilos.chip, pressed && estilos.presionado]}
            >
              <Text style={estilos.chipTexto}>{categoria}</Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

export default function PorRevisar() {
  const router = useRouter();
  const { movimientos, corregirCategoria } = useMovimientos();

  const pendientes = useMemo(
    () => movimientos.filter((m) => m.monto < 0 && m.categoria === null),
    [movimientos],
  );
  const todasLasCategorias = useMemo(() => categoriasEnUso(movimientos), [movimientos]);
  const cobertura = coberturaAutomatica(movimientos);

  return (
    <Pantalla
      titulo="Por revisar"
      etiqueta={String(pendientes.length)}
      onAtras={() => router.back()}
    >
      {pendientes.length === 0 ? (
        <Nota>
          No queda nada por revisar. Todos tus movimientos tienen categoría.
        </Nota>
      ) : (
        pendientes.map((m) => (
          <Tarjeta
            key={m.id}
            movimiento={m}
            sugerencia={sugerirCategorias(m, movimientos)}
            todas={todasLasCategorias}
            onElegir={(categoria) => corregirCategoria(m.id, categoria)}
          />
        ))
      )}

      <Text style={estilos.cobertura}>
        El sistema clasificó solo el <Text style={estilos.destacado}>{cobertura}%</Text> de tus
        movimientos. Cada corrección tuya lo entrena para la próxima vez.
      </Text>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginBottom: espacio.m,
    gap: espacio.xs,
  },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: espacio.m },
  glosa: { color: colores.texto, fontFamily: fuente.mono, fontSize: 15, flexShrink: 1 },
  monto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 19, letterSpacing: -0.3 },
  origen: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14 },
  pregunta: {
    color: colores.texto3,
    fontFamily: fuente.tituloMedio,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: espacio.m,
  },
  aclaracion: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13 },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s, marginTop: espacio.s },
  chip: {
    backgroundColor: colores.chip,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.s + 2,
    borderRadius: radio.m,
  },
  chipPrincipal: { backgroundColor: colores.acento },
  presionado: { opacity: 0.75 },
  chipTexto: { color: colores.texto2, fontFamily: fuente.textoFuerte, fontSize: 15 },
  chipTextoPrincipal: { color: "#FFFFFF" },
  cobertura: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 14,
    lineHeight: 21,
    marginTop: espacio.l,
  },
  destacado: { color: colores.texto, fontFamily: fuente.textoFuerte },
});
