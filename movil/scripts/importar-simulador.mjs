/**
 * Convierte los movimientos del simulador SFA al modelo canónico de la app.
 *
 * Lee simulador/app/datos_banco.json (formato del estándar, tal como lo manda
 * el banco) y escribe src/datos/movimientos.json (formato del contrato,
 * src/modelo/tipos.ts). Es, a pequeña escala, lo que hará la normalización
 * del backend. Se corre una vez y el resultado se versiona:
 *
 *     node scripts/importar-simulador.mjs [ruta/a/datos_banco.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const ORIGEN = resolve(aqui, process.argv[2] ?? "../../simulador/app/datos_banco.json");
const DESTINO = resolve(aqui, "../src/datos/movimientos.json");

const INSTITUCION = "Banco Andino";
const CUENTA = "CTA-0001";

// De la taxonomía del banco a la de Velvet Wallet. Cada institución manda la
// suya; esta tabla es el trabajo que en el sistema final hace el clasificador.
const CATEGORIA_PROPIA = {
  Alimentos: "Supermercado",
  Restaurantes: "Delivery",
  Entretenimiento: "Entretención",
  Servicios: "Servicios",
  Vivienda: "Vivienda",
  Transporte: "Transporte",
  Vestuario: "Vestuario",
  Salud: "Salud",
};

// Cargos que el detector de recurrencias marcaría como periódicos.
const RECURRENTES = new Set([
  "Inmobiliaria Los Robles",
  "Netflix", "Spotify", "Smart Fit", "iCloud",
  "CGE", "Essal", "Abastible",
]);

/**
 * Referencia corta y determinista al documento crudo, imitando la forma
 * "tx/<8 hex>" que tendrá el ObjectId de MongoDB. Mismo ID → misma referencia.
 */
function referenciaCruda(transactionID) {
  let h = 2166136261;
  for (const c of transactionID) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return "tx/" + h.toString(16).padStart(8, "0");
}

/** La sincronización corre de noche: se "recibe" el mismo día a las 23:10. */
function recibidoEn(bookingDateTime) {
  const d = new Date(bookingDateTime);
  d.setUTCHours(23, 10, 0, 0);
  return d.toISOString();
}

function normalizar(m) {
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
    recibidoEn: recibidoEn(m.bookingDateTime),
    payloadCrudoRef: referenciaCruda(m.transactionID),
    correcciones: [],
  };
}

const crudos = JSON.parse(readFileSync(ORIGEN, "utf8"));
const movimientos = crudos
  .map(normalizar)
  .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)); // más reciente primero

writeFileSync(DESTINO, JSON.stringify(movimientos, null, 2) + "\n", "utf8");

const sinCategoria = movimientos.filter((m) => m.estadoCategoria === "sin_categoria").length;
console.log(`${movimientos.length} movimientos → ${DESTINO}`);
console.log(`  recurrentes: ${movimientos.filter((m) => m.esRecurrente).length}`);
console.log(`  sin categoría: ${sinCategoria}`);
