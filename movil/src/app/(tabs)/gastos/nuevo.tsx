/**
 * Registrar un gasto en efectivo (RF-13).
 *
 * El efectivo es lo único que no llega por el estándar: ningún banco lo ve. Si
 * no se anota, el resumen del mes miente justo en los gastos chicos y
 * frecuentes. Por eso el formulario apunta a anotarlo en segundos: monto,
 * en qué, y la fecha y la categoría con un toque en el caso común.
 *
 * Entra al mismo modelo que los movimientos del banco, así que cuenta en el
 * resumen, el flujo y las metas sin nada aparte.
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Tocable } from "@/components/Movimiento";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { Segmentos } from "@/components/Segmentos";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { useMovimientos } from "@/datos/MovimientosContexto";
import { pesos } from "@/utils/formato";
import { categoriasParaElegir, haceDias, leerFecha, leerMonto } from "@/utils/gastoManual";

type Cuando = "hoy" | "ayer" | "otro";

const CUANDO: { valor: Cuando; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "ayer", etiqueta: "Ayer" },
  { valor: "otro", etiqueta: "Otro día" },
];

export default function NuevoGasto() {
  const router = useRouter();
  const { movimientos, agregarGasto } = useMovimientos();

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cuando, setCuando] = useState<Cuando>("hoy");
  const [otraFecha, setOtraFecha] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorias = useMemo(() => categoriasParaElegir(movimientos), [movimientos]);

  const montoLeido = leerMonto(monto);
  const fecha =
    cuando === "hoy" ? haceDias(0) : cuando === "ayer" ? haceDias(1) : leerFecha(otraFecha);
  const texto = descripcion.trim();
  const listo = montoLeido !== null && texto.length > 0 && fecha !== null;

  // Los errores de un campo se muestran recién cuando hay algo escrito: avisar
  // "monto inválido" sobre un campo vacío que la persona aún no toca es ruido.
  const errorMonto =
    monto.trim() && montoLeido === null ? "Escribe un monto entre $1 y $50.000.000." : null;
  const errorFecha =
    cuando === "otro" && otraFecha.trim() && fecha === null
      ? "Usa día-mes-año, por ejemplo 15-10-2026. No puede ser una fecha futura."
      : null;

  async function guardar() {
    if (!listo || montoLeido === null || fecha === null) return;
    setGuardando(true);
    setError(null);
    try {
      const nuevo = await agregarGasto({ monto: montoLeido, descripcion: texto, fecha, categoria });
      // replace y no push: volver atrás desde el detalle tiene que llevar a la
      // lista, no al formulario ya enviado.
      router.replace(`/gastos/${nuevo.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el gasto.");
      setGuardando(false);
    }
  }

  return (
    <Pantalla titulo="Gasto en efectivo" onAtras={() => router.back()}>
      <Campo
        etiqueta="Monto"
        placeholder="4500"
        value={monto}
        onChangeText={setMonto}
        keyboardType="number-pad"
        error={errorMonto}
        autoFocus
      />
      {montoLeido !== null ? <Text style={estilos.eco}>{pesos(montoLeido)}</Text> : null}

      <Campo
        etiqueta="¿En qué?"
        placeholder="Almuerzo, feria, estacionamiento…"
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={120}
      />

      <Seccion titulo="Cuándo" />
      <Segmentos opciones={CUANDO} valor={cuando} onCambio={setCuando} />
      {cuando === "otro" ? (
        <Campo
          etiqueta="Fecha"
          placeholder="15-10-2026"
          value={otraFecha}
          onChangeText={setOtraFecha}
          keyboardType="numbers-and-punctuation"
          error={errorFecha}
        />
      ) : null}

      <Seccion titulo="Categoría" />
      <View style={estilos.categorias}>
        {categorias.map((c) => {
          const activa = c === categoria;
          return (
            <Tocable
              key={c}
              onPress={() => setCategoria(activa ? null : c)}
              style={[estilos.chip, activa && estilos.chipActivo]}
            >
              <Text style={[estilos.chipTexto, activa && estilos.chipTextoActivo]}>{c}</Text>
            </Tocable>
          );
        })}
      </View>
      {categoria === null ? (
        <Text style={estilos.pista}>
          Si no eliges una, queda en Por revisar y la asignas después.
        </Text>
      ) : null}

      <Boton
        titulo="Registrar gasto"
        onPress={guardar}
        cargando={guardando}
        deshabilitado={!listo}
        style={estilos.guardar}
      />
      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Nota>
        Cuenta en tu resumen del mes, en lo que te queda disponible y en la proyección de tus
        metas, igual que lo que llega de tu banco.
      </Nota>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  eco: {
    color: colores.texto3,
    fontFamily: fuente.textoMedio,
    fontSize: 13,
    marginTop: espacio.xs,
    marginBottom: espacio.m,
  },
  categorias: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s },
  // Mismo aspecto que components/Chips, pero en varias líneas: en un
  // formulario todas las opciones tienen que verse sin deslizar.
  chip: {
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.l,
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
  },
  chipActivo: { backgroundColor: colores.acentoSuave, borderColor: colores.acento },
  chipTexto: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 14 },
  chipTextoActivo: { color: colores.acento },
  pista: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, marginTop: espacio.s },
  guardar: { marginTop: espacio.l },
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.m },
});
