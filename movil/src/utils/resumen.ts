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
