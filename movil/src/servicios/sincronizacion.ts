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

// ───────────────────── autorización ante la institución ─────────────────────
//
// Antes de leer un solo dato hay que pasar por tres pasos, en este orden:
//
//   1. Token de participante (Client Credentials) — probar que quien llama es
//      un participante habilitado del SFA.
//   2. Consentimiento con alcance (RAR) — decir a qué datos se pide acceso.
//   3. Autorización — el usuario aprueba y recién ahí se emite el token que
//      permite leer.
//
// En el SFA real el paso 3 ocurre en el sitio del banco: el usuario entra con
// sus credenciales ALLÁ y aprueba. Por eso la app nunca ve la clave bancaria.
// Acá se simula con una llamada, pero el orden y el significado son los mismos.

/** Credenciales del participante. En el SFA real se obtienen al habilitarse. */
const CLIENTE_ID = "velvet-wallet";
const CLIENTE_SECRET = "secreto-demo";

/** A qué datos se pide acceso. Es el alcance que el usuario autoriza. */
const PERMISOS = ["ReadAccountsBasic", "ReadBalances", "ReadTransactionsDetail"];

/** Token de acceso vigente, para no rehacer el flujo en cada sincronización. */
let tokenAcceso: string | null = null;

async function pedir(ruta: string, cuerpo: unknown, token?: string): Promise<any> {
  const respuesta = await fetch(`${BASE_SIMULADOR}/accounts/v1${ruta}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) {
    throw new ErrorSincronizacion(
      `La institución rechazó la autorización (${respuesta.status}).`,
    );
  }
  return respuesta.json();
}

async function autorizar(): Promise<string> {
  // 1. Identificarse como participante.
  const participante = await pedir("/token", {
    grant_type: "client_credentials",
    client_id: CLIENTE_ID,
    client_secret: CLIENTE_SECRET,
  });

  // 2. Pedir el consentimiento, diciendo a qué datos.
  const consentimiento = await pedir(
    "/consents",
    { permissions: PERMISOS },
    participante.access_token,
  );

  // 3. El usuario autoriza; se emite el token de acceso.
  const acceso = await pedir(
    `/consents/${consentimiento.data.consentId}/authorise`,
    {},
    participante.access_token,
  );

  return acceso.access_token;
}

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

  const url = `${BASE_SIMULADOR}/accounts/v1/accounts/${CUENTA}/transactions?${params}`;

  const leer = async (token: string | null) => {
    try {
      return await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new ErrorSincronizacion(
        "No se pudo conectar con la institución. Revisa que el simulador esté corriendo.",
      );
    }
  };

  if (!tokenAcceso) tokenAcceso = await autorizar();
  let respuesta = await leer(tokenAcceso);

  // 401 = el consentimiento venció o fue revocado. No es un error técnico:
  // se renueva la autorización y se reintenta una vez.
  if (respuesta.status === 401) {
    tokenAcceso = await autorizar();
    respuesta = await leer(tokenAcceso);
  }

  if (!respuesta.ok) {
    throw new ErrorSincronizacion(`La institución respondió ${respuesta.status}.`);
  }

  const cuerpo = (await respuesta.json()) as { data: { transactions: MovimientoSFA[] } };
  return cuerpo.data.transactions.map(normalizar);
}
