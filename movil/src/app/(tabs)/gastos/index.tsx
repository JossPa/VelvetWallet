/**
 * Gastos — los cargos de un mes, filtrables por tipo y categoría.
 *
 * "Fijos" son los que el detector de recurrencias marcó como periódicos
 * (arriendo, suscripciones, cuentas del hogar). "Variables" es todo lo demás.
 * Los meses y las categorías disponibles salen de los datos, no están fijos.
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Aviso } from "@/components/Aviso";
import { Chips } from "@/components/Chips";
import { FilaMovimiento } from "@/components/FilaMovimiento";
import { Nota, Pantalla } from "@/components/Pantalla";
import { Segmentos } from "@/components/Segmentos";
import { SelectorMes } from "@/components/SelectorMes";
import { colores, espacio, fuente } from "@/constants/tema";
import { MOVIMIENTOS } from "@/datos/movimientos";
import { claveMes, pesos } from "@/utils/formato";

type Tipo = "todos" | "fijos" | "variables";

const TIPOS: { valor: Tipo; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "fijos", etiqueta: "Fijos" },
  { valor: "variables", etiqueta: "Variables" },
];

const TODAS = "__todas__";
const SIN_CATEGORIA = "__sin__";

// Meses con datos, del más reciente al más antiguo. Se calcula una vez.
const MESES = [...new Set(MOVIMIENTOS.map((m) => claveMes(m.fecha)))].sort().reverse();

export default function Gastos() {
  const router = useRouter();
  const [mes, setMes] = useState(MESES[0]);
  const [tipo, setTipo] = useState<Tipo>("todos");
  const [categoria, setCategoria] = useState<string>(TODAS);

  const cargosDelMes = useMemo(
    () => MOVIMIENTOS.filter((m) => m.monto < 0 && claveMes(m.fecha) === mes),
    [mes],
  );

  // Chips de categoría: las que existen este mes, más "Sin categorizar" si hay.
  const opcionesCategoria = useMemo(() => {
    const presentes = [...new Set(cargosDelMes.map((m) => m.categoria).filter(Boolean))] as string[];
    const opciones = [{ valor: TODAS, etiqueta: "Todas" }, ...presentes.sort().map((c) => ({ valor: c, etiqueta: c }))];
    if (cargosDelMes.some((m) => m.categoria === null)) {
      opciones.push({ valor: SIN_CATEGORIA, etiqueta: "Sin categorizar" });
    }
    return opciones;
  }, [cargosDelMes]);

  const visibles = useMemo(() => {
    let lista = cargosDelMes;
    if (tipo === "fijos") lista = lista.filter((m) => m.esRecurrente);
    if (tipo === "variables") lista = lista.filter((m) => !m.esRecurrente);
    if (categoria === SIN_CATEGORIA) lista = lista.filter((m) => m.categoria === null);
    else if (categoria !== TODAS) lista = lista.filter((m) => m.categoria === categoria);
    return lista;
  }, [cargosDelMes, tipo, categoria]);

  const total = visibles.reduce((suma, m) => suma + Math.abs(m.monto), 0);
  const sinCategorizar = cargosDelMes.filter((m) => m.estadoCategoria === "sin_categoria").length;

  // Al cambiar de mes, la categoría elegida puede no existir: se vuelve a "Todas".
  function cambiarMes(nuevo: string) {
    setMes(nuevo);
    setCategoria(TODAS);
  }

  return (
    <Pantalla titulo="Gastos" accesorio={<SelectorMes meses={MESES} valor={mes} onCambio={cambiarMes} />}>
      <Segmentos opciones={TIPOS} valor={tipo} onCambio={setTipo} />
      {/* key={mes}: al cambiar de mes la fila se reconstruye y vuelve al inicio */}
      <Chips key={mes} opciones={opcionesCategoria} valor={categoria} onCambio={setCategoria} />

      <View style={estilos.resumen}>
        <Text style={estilos.resumenTexto}>
          {visibles.length} {visibles.length === 1 ? "movimiento" : "movimientos"}
        </Text>
        <Text style={estilos.resumenTotal}>{pesos(total)}</Text>
      </View>

      {sinCategorizar > 0 ? (
        <Aviso detalle="Tócalos para asignarles una categoría.">
          {sinCategorizar} {sinCategorizar === 1 ? "movimiento" : "movimientos"} por categorizar.
        </Aviso>
      ) : null}

      <View style={estilos.lista}>
        {visibles.map((m) => (
          <FilaMovimiento key={m.id} movimiento={m} onPress={() => router.push(`/gastos/${m.id}`)} />
        ))}
      </View>

      {visibles.length === 0 ? <Nota>No hay movimientos con estos filtros.</Nota> : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  resumen: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingBottom: espacio.s,
  },
  resumenTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13 },
  resumenTotal: { color: colores.texto2, fontFamily: fuente.tituloMedio, fontSize: 15 },
  lista: { marginTop: espacio.s },
});
