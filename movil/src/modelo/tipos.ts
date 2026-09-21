/**
 * Modelo de datos que consume la aplicación.
 *
 * ESTE ARCHIVO ES EL CONTRATO CON EL BACKEND. Lo que está definido acá es lo
 * que la API debe devolver; la app no sabe ni le importa de dónde salió
 * (SFA, cartola, carga manual). Cualquier cambio se acuerda entre ambos.
 *
 * Fechas: siempre texto ISO 8601 con zona horaria ("2026-09-21T14:32:00-03:00").
 * Montos: enteros en pesos chilenos, con signo (negativo = cargo).
 */

/** Estado de la conexión con una institución. Es un estado del usuario, no un error técnico. */
export type EstadoConexion =
  | "al_dia"                // la última sincronización funcionó
  | "sin_respuesta"         // la institución no respondió; el dato es de la última vez
  | "autorizacion_vencida"; // el consentimiento expiró; el usuario debe reautorizar

export type Conexion = {
  id: string;
  institucion: string;
  estado: EstadoConexion;
  /** Última vez que se obtuvieron datos con éxito. */
  ultimaSincronizacion: string;
  /** Solo cuando estado = "autorizacion_vencida". */
  autorizacionVencioEl?: string;
  cuentas: CuentaConectada[];
};

export type CuentaConectada = {
  id: string;
  /** Tal como lo entrega la institución: "Cuenta Corriente", "Cuenta Vista"… */
  tipo: string;
  alias: string;
  saldo: number;
  moneda: "CLP";
};
