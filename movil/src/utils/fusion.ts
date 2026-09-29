/**
 * Fusión de lo que llega de la institución con lo que ya está guardado.
 *
 * Es el punto donde el estándar SFA obliga a tener cuidado: **no existe un
 * campo que diga si un movimiento está pendiente o confirmado**. Una compra
 * pre-autorizada se confirma días después reapareciendo con el MISMO
 * `transactionID` y OTRO monto. Si se insertara por llegada, el usuario vería
 * el mismo gasto dos veces y su total estaría mal.
 *
 * Por eso la clave es el identificador de la institución, no el contenido:
 *   · ID que no existía  → insertar
 *   · ID que ya existía  → actualizar, sin duplicar
 *
 * Segunda regla, igual de importante: **las correcciones del usuario
 * sobreviven a la resincronización** (RF-14). El banco manda de nuevo su
 * versión del dato, pero lo que el usuario corrigió encima se conserva.
 */
import type { Movimiento } from "@/modelo/tipos";

export type ResultadoFusion = {
  /** La lista completa ya fusionada y ordenada, de la más reciente a la más antigua. */
  movimientos: Movimiento[];
  /** IDs de los que no existían antes. */
  nuevos: string[];
  /** Los que ya estaban y cambiaron de monto, con el valor que tenían. */
  actualizados: { id: string; montoAnterior: number }[];
};

/**
 * Combina un movimiento guardado con la versión que acaba de llegar.
 * Del banco se toma lo que el banco manda; del guardado se conserva todo lo
 * que puso el usuario o dedujo el sistema.
 */
function combinar(guardado: Movimiento, entrante: Movimiento): Movimiento {
  const corregido = guardado.estadoCategoria === "corregida";

  return {
    ...entrante,
    // Lo que el usuario corrigió manda sobre lo que diga el banco.
    categoria: corregido ? guardado.categoria : entrante.categoria,
    estadoCategoria: corregido ? "corregida" : entrante.estadoCategoria,
    excluido: guardado.excluido,
    correcciones: guardado.correcciones,
    // La primera recepción es la que vale para la trazabilidad.
    recibidoEn: guardado.recibidoEn,
  };
}

export function fusionar(actuales: Movimiento[], entrantes: Movimiento[]): ResultadoFusion {
  const porId = new Map(actuales.map((m) => [m.id, m]));
  const nuevos: string[] = [];
  const actualizados: { id: string; montoAnterior: number }[] = [];

  for (const entrante of entrantes) {
    const guardado = porId.get(entrante.id);

    if (!guardado) {
      porId.set(entrante.id, entrante);
      nuevos.push(entrante.id);
      continue;
    }

    if (guardado.monto !== entrante.monto) {
      porId.set(entrante.id, combinar(guardado, entrante));
      actualizados.push({ id: entrante.id, montoAnterior: guardado.monto });
    }
    // Si llegó igual, no se toca: evita reescribir sin motivo.
  }

  const movimientos = [...porId.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return { movimientos, nuevos, actualizados };
}
