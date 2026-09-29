/**
 * Cálculos del resumen del mes — la pregunta "¿cuánto tengo disponible?".
 *
 * Solo lógica, sin nada visual. Cuando exista el backend, estas mismas reglas
 * se implementan allá y la app recibe el resultado: el disponible lo necesitan
 * también el motor de proyección y las metas, y tiene que salir igual en todos.
 *
 * Reglas:
 *  · Ingresos del mes = el sueldo detectado, no los abonos recibidos ese mes.
 *    El sueldo llega a fin de mes; si se contaran abonos, hasta ese día el
 *    disponible sería negativo. Principio heredado de la v1: el sueldo se
 *    mantiene mes a mes.
 *  · Gastos del mes = cargos del mes hasta hoy, sin los excluidos.
 *  · Disponible = ingresos − gastos.
 */
import type { Conexion, Movimiento } from "@/modelo/tipos";
import { claveMes } from "@/utils/formato";

export type ResumenMes = {
  mes: string;
  ingresos: number;
  gastos: number;
  disponible: number;
  cantidadGastos: number;
  /** Día del mes en que llega el sueldo, según el historial. */
  diaDePago: number | null;
};

/**
 * Sueldo detectado: el abono más reciente categorizado como sueldo.
 * Cuando exista la configuración del usuario (RF-36), esta función la combina.
 */
export function sueldoDetectado(movimientos: Movimiento[]): Movimiento | null {
  return movimientos.find((m) => m.monto > 0 && m.categoria === "Sueldo") ?? null;
}

export function resumenDelMes(movimientos: Movimiento[], mes: string): ResumenMes {
  const sueldo = sueldoDetectado(movimientos);
  const cargos = movimientos.filter((m) => m.monto < 0 && !m.excluido && claveMes(m.fecha) === mes);
  const gastos = cargos.reduce((suma, m) => suma + Math.abs(m.monto), 0);
  const ingresos = sueldo?.monto ?? 0;

  return {
    mes,
    ingresos,
    gastos,
    disponible: ingresos - gastos,
    cantidadGastos: cargos.length,
    diaDePago: sueldo ? new Date(sueldo.fecha).getDate() : null,
  };
}

/** Conexiones que no están al día, para el aviso del resumen. */
export function conexionesConProblema(conexiones: Conexion[]): Conexion[] {
  return conexiones.filter((c) => c.estado !== "al_dia");
}

// ───────────────────── en qué se va la plata ─────────────────────

export type PorcionCategoria = {
  categoria: string;
  monto: number;
  /** Fracción del gasto total del mes, entre 0 y 1. */
  fraccion: number;
};

const SIN_CATEGORIA = "Sin categorizar";

/** Suma los cargos del mes por categoría, de mayor a menor. */
function totalesPorCategoria(movimientos: Movimiento[], mes: string): Map<string, number> {
  const totales = new Map<string, number>();
  for (const m of movimientos) {
    if (m.monto >= 0 || m.excluido || claveMes(m.fecha) !== mes) continue;
    const clave = m.categoria ?? SIN_CATEGORIA;
    totales.set(clave, (totales.get(clave) ?? 0) + Math.abs(m.monto));
  }
  return totales;
}

/**
 * Reparto del gasto del mes por categoría.
 *
 * Se muestran las `maximo` más grandes y el resto se agrupa en "Otros": un
 * gráfico con quince porciones no comunica nada.
 */
export function repartoPorCategoria(
  movimientos: Movimiento[],
  mes: string,
  maximo = 5,
): { porciones: PorcionCategoria[]; total: number } {
  const totales = [...totalesPorCategoria(movimientos, mes).entries()].sort((a, b) => b[1] - a[1]);
  const total = totales.reduce((suma, [, monto]) => suma + monto, 0);
  if (total === 0) return { porciones: [], total: 0 };

  const principales = totales.slice(0, maximo);
  const resto = totales.slice(maximo).reduce((suma, [, monto]) => suma + monto, 0);

  const porciones: PorcionCategoria[] = principales.map(([categoria, monto]) => ({
    categoria,
    monto,
    fraccion: monto / total,
  }));
  if (resto > 0) porciones.push({ categoria: "Otros", monto: resto, fraccion: resto / total });

  return { porciones, total };
}

export type Variacion = {
  categoria: string;
  actual: number;
  anterior: number;
  /** Cambio porcentual. null cuando no había gasto el mes anterior. */
  porcentaje: number | null;
};

/** Mes anterior a "2026-09" → "2026-08". */
export function mesAnterior(mes: string): string {
  const anio = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));
  return numero === 1
    ? `${anio - 1}-12`
    : `${anio}-${String(numero - 1).padStart(2, "0")}`;
}

/**
 * Comparación con el mes anterior, ordenada por el cambio más grande.
 *
 * Solo tiene sentido si el mes anterior está completo; con el mes en curso a
 * medias, la comparación de totales siempre saldría a la baja.
 */
export function compararConMesAnterior(
  movimientos: Movimiento[],
  mes: string,
  cuantas = 3,
): { variaciones: Variacion[]; total: Variacion } | null {
  const previo = mesAnterior(mes);
  const actuales = totalesPorCategoria(movimientos, mes);
  const anteriores = totalesPorCategoria(movimientos, previo);
  if (anteriores.size === 0) return null;

  const cambio = (actual: number, anterior: number) =>
    anterior === 0 ? null : Math.round(((actual - anterior) / anterior) * 100);

  const variaciones: Variacion[] = [...new Set([...actuales.keys(), ...anteriores.keys()])]
    .map((categoria) => {
      const actual = actuales.get(categoria) ?? 0;
      const anterior = anteriores.get(categoria) ?? 0;
      return { categoria, actual, anterior, porcentaje: cambio(actual, anterior) };
    })
    // Las que aparecen en ambos meses y más se movieron, en valor absoluto.
    .filter((v) => v.porcentaje !== null && v.anterior > 0)
    .sort((a, b) => Math.abs(b.porcentaje!) - Math.abs(a.porcentaje!))
    .slice(0, cuantas);

  const sumar = (t: Map<string, number>) => [...t.values()].reduce((s, n) => s + n, 0);
  const totalActual = sumar(actuales);
  const totalAnterior = sumar(anteriores);

  return {
    variaciones,
    total: {
      categoria: "Total del mes",
      actual: totalActual,
      anterior: totalAnterior,
      porcentaje: cambio(totalActual, totalAnterior),
    },
  };
}
