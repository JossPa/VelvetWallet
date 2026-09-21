/**
 * Formatos compartidos: pesos chilenos y fechas en lenguaje natural.
 */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 825486 → "$825.486". Negativos → "−$184.320" (con el signo menos tipográfico). */
export function pesos(monto: number): string {
  const abs = Math.abs(Math.round(monto)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (monto < 0 ? "−" : "") + "$" + abs;
}

const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const dosDigitos = (n: number) => n.toString().padStart(2, "0");

/** "2026-09" → clave de mes; sirve para agrupar y filtrar. */
export function claveMes(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}`;
}

/** "2026-09" → "Septiembre". */
export function nombreMes(clave: string): string {
  const mes = Number(clave.slice(5, 7)) - 1;
  const nombre = MESES_LARGO[mes];
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/** Fecha como la muestra la lista: "hoy", "ayer" o "22 ago". */
export function fechaLista(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === ahora.toDateString()) return "hoy";
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return "ayer";
  return fechaCorta(iso);
}

/** Fecha corta: "3 sep". */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Fecha y hora: "21 ago 19:42". */
export function fechaHora(iso: string): string {
  return `${fechaCorta(iso)} ${hora(iso)}`;
}

/** Hora: "14:32". */
export function hora(iso: string): string {
  const d = new Date(iso);
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
}

/**
 * Tiempo relativo en lenguaje natural, como lo muestra el mockup:
 * "recién", "hace 12 min", "hace 2 horas", "ayer 14:32", "el 3 sep".
 */
export function tiempoRelativo(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60_000);

  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24 && fecha.getDate() === ahora.getDate()) {
    return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  }

  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (fecha.toDateString() === ayer.toDateString()) return `ayer ${hora(iso)}`;

  return `el ${fechaCorta(iso)}`;
}
