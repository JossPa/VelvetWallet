/**
 * Lo que necesita el formulario de gasto en efectivo (RF-13): leer lo que la
 * persona escribe y ofrecerle categorías.
 *
 * Son funciones puras para poder probarlas; la pantalla solo las usa.
 */
import type { Movimiento } from "@/modelo/tipos";

/**
 * Categorías de gasto de Velvet Wallet. Es la misma lista del clasificador del
 * backend (backend/clasificador/taxonomia.py): un gasto anotado a mano tiene
 * que caer en las mismas categorías que uno que llega del banco, o el resumen
 * del mes los separaría.
 */
export const CATEGORIAS_GASTO = [
  "Supermercado",
  "Delivery",
  "Restaurantes",
  "Transporte",
  "Servicios",
  "Entretención",
  "Suscripciones",
  "Salud",
  "Gimnasio",
  "Vivienda",
  "Vestuario",
  "Educación",
  "Hogar",
];

/** Tope del backend. Un monto mayor es casi seguro un cero de más. */
export const MONTO_MAXIMO = 50_000_000;

/** "4.500", "$4500" o "4500" → 4500. null si no hay un monto válido. */
export function leerMonto(texto: string): number | null {
  const limpio = texto.replace(/[^\d]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 && n <= MONTO_MAXIMO ? n : null;
}

const dosDigitos = (n: number) => n.toString().padStart(2, "0");

/** Date → "AAAA-MM-DD" con la fecha LOCAL (no la UTC, que en Chile adelanta un día de noche). */
export function aFechaIso(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/** Hoy menos `dias`, como "AAAA-MM-DD". */
export function haceDias(dias: number, ahora: Date = new Date()): string {
  const d = new Date(ahora);
  d.setDate(d.getDate() - dias);
  return aFechaIso(d);
}

/**
 * "15-10-2026" o "15/10/2026" → "2026-10-15".
 *
 * Día primero, como se escribe en Chile. null si la fecha no existe (31 de
 * febrero), si es futura o si es de antes de 2000: el backend la rechazaría
 * igual, pero acá se puede avisar antes de mandar nada.
 */
export function leerFecha(texto: string, ahora: Date = new Date()): string | null {
  const m = texto.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return null;
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(anio, mes - 1, dia);
  // new Date corrige solo las fechas imposibles (31-02 → 3 de marzo): si no
  // coincide con lo escrito, la fecha no existía.
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  if (anio < 2000) return null;
  const iso = aFechaIso(d);
  return iso > aFechaIso(ahora) ? null : iso;
}

/**
 * Las categorías para elegir: primero las que la persona más usa (es lo más
 * probable para un gasto nuevo), después el resto de la lista de Velvet y,
 * al final, las propias que haya creado al corregir.
 */
export function categoriasParaElegir(movimientos: Movimiento[], cuantasFrecuentes = 4): string[] {
  const usos = new Map<string, number>();
  for (const m of movimientos) {
    if (m.monto < 0 && m.categoria) usos.set(m.categoria, (usos.get(m.categoria) ?? 0) + 1);
  }
  const frecuentes = [...usos.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cuantasFrecuentes)
    .map(([c]) => c);
  const resto = CATEGORIAS_GASTO.filter((c) => !frecuentes.includes(c));
  const propias = [...usos.keys()]
    .filter((c) => !frecuentes.includes(c) && !CATEGORIAS_GASTO.includes(c))
    .sort();
  return [...frecuentes, ...resto, ...propias];
}
