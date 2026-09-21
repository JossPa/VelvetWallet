/**
 * Formatos compartidos: pesos chilenos y fechas en lenguaje natural.
 */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 825486 → "$825.486". Negativos → "−$184.320" (con el signo menos tipográfico). */
export function pesos(monto: number): string {
  const abs = Math.abs(Math.round(monto)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (monto < 0 ? "−" : "") + "$" + abs;
}

const dosDigitos = (n: number) => n.toString().padStart(2, "0");

/** Fecha corta: "3 sep". */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
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
