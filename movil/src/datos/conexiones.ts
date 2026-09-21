/**
 * Datos de desarrollo — conexiones.
 *
 * Reemplaza al backend mientras no existe. Tiene la forma exacta del contrato
 * (src/modelo/tipos.ts), así que cuando exista el endpoint se cambia la fuente
 * y las pantallas no se tocan.
 *
 * La primera conexión es la entidad del simulador SFA (dos cuentas, saldos
 * reales del simulador). Las otras dos existen para ejercitar los estados
 * "sin respuesta" y "autorización vencida"; para una demo se pueden quitar.
 */
import type { Conexion } from "@/modelo/tipos";

/** Nombre ficticio de la entidad financiera simulada. */
export const BANCO_SIMULADO = "Banco Andino";

const hace = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();

const ayerA = (hora: number, minuto: number) => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
};

export const CONEXIONES: Conexion[] = [
  {
    id: "cx-andino",
    institucion: BANCO_SIMULADO,
    estado: "al_dia",
    ultimaSincronizacion: hace(2),
    cuentas: [
      { id: "CTA-0001", tipo: "Cuenta Corriente", alias: "Mi cuenta sueldo", saldo: 825_486, moneda: "CLP" },
      { id: "CTA-0002", tipo: "Cuenta Vista", alias: "Ahorro", saldo: 120_000, moneda: "CLP" },
    ],
  },
  {
    id: "cx-falabella",
    institucion: "Banco Falabella",
    estado: "sin_respuesta",
    ultimaSincronizacion: ayerA(14, 32),
    cuentas: [{ id: "FAL-01", tipo: "Tarjeta de Crédito", alias: "CMR", saldo: -184_320, moneda: "CLP" }],
  },
  {
    id: "cx-mercadopago",
    institucion: "Mercado Pago",
    estado: "autorizacion_vencida",
    ultimaSincronizacion: hace(24 * 20),
    autorizacionVencioEl: hace(24 * 18),
    cuentas: [{ id: "MP-01", tipo: "Cuenta Digital", alias: "Mercado Pago", saldo: 42_150, moneda: "CLP" }],
  },
];
