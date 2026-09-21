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

/** Por qué camino entró el movimiento al sistema. */
export type OrigenMovimiento = "sfa" | "cartola" | "manual";

/** Cómo quedó la categoría: la puso el clasificador, la corrigió el usuario, o no hay. */
export type EstadoCategoria = "automatica" | "corregida" | "sin_categoria";

/** Corrección hecha por el usuario. Se guarda aparte; el dato original no se modifica. */
export type Correccion = {
  tipo: "recategorizar" | "marcar_duplicado" | "excluir" | "dividir";
  fecha: string;
  detalle?: string;
};

/**
 * Un movimiento ya normalizado al modelo canónico.
 *
 * Se guardan por separado lo que dijo el banco (glosaOriginal, categoriaBanco)
 * y lo que el sistema entendió (comercio, categoria). El dato original nunca
 * se pierde; las correcciones se aplican encima.
 */
export type Movimiento = {
  id: string;
  cuentaId: string;
  institucion: string;
  fecha: string;
  /** Con signo: negativo = cargo, positivo = abono. */
  monto: number;
  moneda: "CLP";
  /** Nombre normalizado ("Uber Eats"). null si no se pudo identificar. */
  comercio: string | null;
  /** Tal como la mandó la institución ("UBER *EATS 8829 SANTIAGO"). */
  glosaOriginal: string;
  /** Categoría de Velvet Wallet. null = sin categorizar; se muestra en Por revisar. */
  categoria: string | null;
  /** Categoría que mandó la institución, si la mandó. Sin taxonomía común entre bancos. */
  categoriaBanco: string | null;
  estadoCategoria: EstadoCategoria;
  /** Detectado como cargo recurrente (suscripción, arriendo, cuenta del hogar). */
  esRecurrente: boolean;
  /** No es gasto: transferencia entre cuentas propias, por ejemplo. */
  excluido: boolean;
  origen: OrigenMovimiento;

  // ── Trazabilidad (Ley 21.719: registro de tratamiento) ──
  /** Cuándo lo recibió Velvet Wallet. Distinto de `fecha`, que es la del banco. */
  recibidoEn: string;
  /** Referencia al documento crudo en MongoDB tal como llegó. null en carga manual. */
  payloadCrudoRef: string | null;
  /** Correcciones del usuario, en orden. Vacío si no hay. */
  correcciones: Correccion[];
};
