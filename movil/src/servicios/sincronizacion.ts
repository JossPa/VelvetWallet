/**
 * Sincronización: trae los movimientos de la institución y los normaliza.
 *
 * ⚠️ ATAJO TEMPORAL — ANOTADO A PROPÓSITO
 *
 * Las capas acordadas con el backend son:
 *
 *     app  →  backend  →  ingesta  →  cliente SFA  →  simulador
 *
 * Hoy el backend no existe, así que este archivo llama al simulador directo y
 * hace la normalización en el dispositivo. Eso NO es el diseño final: la
 * normalización pertenece al backend, porque ahí viven el clasificador y el
 * detector de recurrencias, y porque el dispositivo no debe hablar con la
 * institución.
 *
 * PENDIENTE cuando el backend exista:
 *  1. Reemplazar BASE por la URL del backend y llamar a /api/movimientos.
 *  2. Borrar normalizar(): el backend entrega el modelo canónico ya listo.
 *  3. Borrar CATEGORIA_PROPIA y RECURRENTES: los reemplazan el clasificador
 *     (bloque E) y el detector de recurrencias (bloque F).
 *  4. Enviar el token de sesión en la cabecera Authorization.
 *  5. Cerrar el CORS abierto del simulador.
 *
 * Nada fuera de este archivo sabe de dónde vienen los datos, así que el cambio
 * no toca ninguna pantalla.
 */
import type { Movimiento } from "@/modelo/tipos";

/**
 * En el navegador localhost es el mismo computador y funciona. En un teléfono
 * con Expo Go, localhost es el teléfono: hay que poner la IP del computador
 * en la red local, por ejemplo "http://192.168.1.23:8001".
 */
export const BASE_SIMULADOR = "http://localhost:8001";

const CUENTA = "CTA-0001";
const INSTITUCION = "Banco Andino";

/** Forma en que el estándar SFA entrega un movimiento. */
type MovimientoSFA = {
  transactionID: string;
  bookingDateTime: string;
  transactionsType: "Cargo" | "Abono";
  amount: number;
  currency: string;
  paymentPurposeCode?: string;
  merchantDetails?: { name?: string; category?: string };
};

// Equivalencia entre la taxonomía del banco y la nuestra. Provisional: cada
// institución manda la suya y no hay taxonomía común, que es justamente el
// problema que resuelve el clasificador.
const CATEGORIA_PROPIA: Record<string, string> = {
  Alimentos: "Supermercado",
  Restaurantes: "Delivery",
  Entretenimiento: "Entretención",
  Servicios: "Servicios",
  Vivienda: "Vivienda",
  Transporte: "Transporte",
  Vestuario: "Vestuario",
  Salud: "Salud",
};

// Provisional: lo reemplaza el detector de recurrencias.
const RECURRENTES = new Set([
  "Inmobiliaria Los Robles",
  "Netflix", "Spotify", "Smart Fit", "iCloud",
  "CGE", "Essal", "Abastible",
]);

/** Referencia al documento crudo, con la forma que tendrá el ObjectId de Mongo. */
function referenciaCruda(id: string): string {
  let h = 2166136261;
  for (const c of id) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return "tx/" + h.toString(16).padStart(8, "0");
}

function normalizar(m: MovimientoSFA): Movimiento {
  const comercio = m.merchantDetails?.name ?? null;
  const categoriaBanco = m.merchantDetails?.category ?? null;
  const esAbono = m.transactionsType === "Abono";

  let categoria = categoriaBanco ? (CATEGORIA_PROPIA[categoriaBanco] ?? null) : null;
  if (esAbono) categoria = "Sueldo";

  return {
    id: m.transactionID,
    cuentaId: CUENTA,
    institucion: INSTITUCION,
    fecha: new Date(m.bookingDateTime).toISOString(),
    monto: Math.round(m.amount) * (esAbono ? 1 : -1),
    moneda: "CLP",
    comercio,
    glosaOriginal: m.paymentPurposeCode ?? comercio ?? "",
    categoria,
    categoriaBanco,
    estadoCategoria: categoria ? "automatica" : "sin_categoria",
    esRecurrente: comercio ? RECURRENTES.has(comercio) : false,
    excluido: false,
    origen: "sfa",
    recibidoEn: new Date().toISOString(),
    payloadCrudoRef: referenciaCruda(m.transactionID),
    correcciones: [],
  };
}

export class ErrorSincronizacion extends Error {}

/**
 * Pide los movimientos posteriores a `desde` y los devuelve normalizados.
 *
 * El filtro por fecha es lo que hace la sincronización incremental: se pide
 * solo lo nuevo en vez del historial completo cada vez.
 */
export async function obtenerMovimientos(desde?: string): Promise<Movimiento[]> {
  const params = new URLSearchParams({ pageSize: "100" });
  if (desde) params.set("fromDate", desde.slice(0, 10));

  // Hasta hoy: una sincronización pide lo ocurrido, no el futuro. El simulador
  // genera el mes completo por comodidad, pero un banco real solo entrega lo
  // que ya pasó. Sin este límite, los días que faltan llegarían como "nuevos".
  params.set("toDate", new Date().toISOString().slice(0, 10));

  let respuesta: Response;
  try {
    respuesta = await fetch(
      `${BASE_SIMULADOR}/accounts/v1/accounts/${CUENTA}/transactions?${params}`,
    );
  } catch {
    throw new ErrorSincronizacion(
      "No se pudo conectar con la institución. Revisa que el simulador esté corriendo.",
    );
  }

  if (!respuesta.ok) {
    throw new ErrorSincronizacion(`La institución respondió ${respuesta.status}.`);
  }

  const cuerpo = (await respuesta.json()) as { data: { transactions: MovimientoSFA[] } };
  return cuerpo.data.transactions.map(normalizar);
}
