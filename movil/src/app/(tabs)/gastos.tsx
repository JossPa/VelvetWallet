/**
 * Gastos — los cargos del mes, con filtro fijos / variables.
 *
 * "Fijos" son los que el detector de recurrencias marcó como periódicos
 * (arriendo, suscripciones, cuentas del hogar). "Variables" es todo lo demás.
 */
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Aviso } from "@/components/Aviso";
import { FilaMovimiento } from "@/components/FilaMovimiento";
import { Nota, Pantalla } from "@/components/Pantalla";
import { Segmentos } from "@/components/Segmentos";
import { MOVIMIENTOS } from "@/datos/movimientos";
import { claveMes, nombreMes } from "@/utils/formato";

type Filtro = "todos" | "fijos" | "variables";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "fijos", etiqueta: "Fijos" },
  { valor: "variables", etiqueta: "Variables" },
];

export default function Gastos() {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // El mes que se muestra: el más reciente con datos. Los movimientos vienen
  // ordenados del más nuevo al más viejo, así que es el del primero.
  const mes = claveMes(MOVIMIENTOS[0].fecha);

  const cargosDelMes = useMemo(
    () => MOVIMIENTOS.filter((m) => m.monto < 0 && claveMes(m.fecha) === mes),
    [mes],
  );

  const visibles = useMemo(() => {
    if (filtro === "fijos") return cargosDelMes.filter((m) => m.esRecurrente);
    if (filtro === "variables") return cargosDelMes.filter((m) => !m.esRecurrente);
    return cargosDelMes;
  }, [cargosDelMes, filtro]);

  const sinCategorizar = cargosDelMes.filter((m) => m.estadoCategoria === "sin_categoria").length;

  return (
    <Pantalla titulo="Gastos" etiqueta={nombreMes(mes)}>
      <Segmentos opciones={FILTROS} valor={filtro} onCambio={setFiltro} />

      <View>
        {visibles.map((m) => (
          <FilaMovimiento key={m.id} movimiento={m} />
        ))}
      </View>

      {visibles.length === 0 ? <Nota>No hay movimientos con este filtro.</Nota> : null}

      {sinCategorizar > 0 ? (
        <Aviso detalle="Tócalos para asignarles una categoría.">
          {sinCategorizar} {sinCategorizar === 1 ? "movimiento" : "movimientos"} por categorizar.
        </Aviso>
      ) : null}
    </Pantalla>
  );
}
