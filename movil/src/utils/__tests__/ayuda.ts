/**
 * Ayuda para las pruebas: construye movimientos sin repetir los quince campos
 * en cada caso. Solo se escribe lo que importa para lo que se está probando.
 */
import type { Movimiento } from "@/modelo/tipos";

let contador = 0;

export function movimiento(campos: Partial<Movimiento> = {}): Movimiento {
  contador += 1;
  return {
    id: `TXN-${contador}`,
    cuentaId: "CTA-0001",
    institucion: "Banco Andino",
    fecha: "2026-09-15T12:00:00.000Z",
    monto: -10_000,
    moneda: "CLP",
    comercio: "Lider",
    glosaOriginal: "Lider",
    categoria: "Supermercado",
    categoriaBanco: "Alimentos",
    estadoCategoria: "automatica",
    esRecurrente: false,
    excluido: false,
    origen: "sfa",
    recibidoEn: "2026-09-15T23:10:00.000Z",
    payloadCrudoRef: "tx/00000000",
    correcciones: [],
    ...campos,
  };
}

/** Movimiento sin categoría, como los que llegan con glosa sucia. */
export function sinCategoria(campos: Partial<Movimiento> = {}): Movimiento {
  return movimiento({
    comercio: null,
    glosaOriginal: "PAGO PSP 4471 STGO",
    categoria: null,
    categoriaBanco: null,
    estadoCategoria: "sin_categoria",
    ...campos,
  });
}

/** El abono mensual del sueldo. */
export function sueldo(campos: Partial<Movimiento> = {}): Movimiento {
  return movimiento({
    monto: 850_000,
    comercio: null,
    glosaOriginal: "Abono de remuneracion",
    categoria: "Sueldo",
    categoriaBanco: null,
    ...campos,
  });
}
