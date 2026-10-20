/**
 * Cómo se le cuenta a la persona lo que dijo la simulación.
 *
 * Está aparte de las pantallas para poder probarlo: redactar mal el resultado
 * de un cálculo correcto es igual de grave que calcularlo mal. En particular,
 * cuando el motor se abstiene hay que decirlo con todas sus letras y no
 * disimularlo con un plazo inventado.
 */
import type { Meta, Proyeccion } from "@/modelo/tipos";

export type Resumen = {
  /** Una línea, la que se lee primero. */
  titular: string;
  /** Contexto debajo. null cuando el titular se basta solo. */
  detalle: string | null;
  /** El titular trae una respuesta real y no una explicación de por qué no la hay. */
  hayRespuesta: boolean;
};

const meses = (n: number) => (n === 1 ? "1 mes" : `${n} meses`);

export function describirProyeccion(meta: Meta): Resumen {
  const p = meta.proyeccion;

  switch (p.estado) {
    case "cumplida":
      return {
        titular: "Ya la alcanzaste",
        detalle: "Tienes reunido el monto completo.",
        hayRespuesta: true,
      };

    case "sin_historial": {
      const faltan = p.mesesMinimos - p.mesesObservados;
      return {
        titular: "Todavía no se puede proyectar",
        detalle:
          `Hacen falta ${meses(p.mesesMinimos)} completos de historial y hay ${p.mesesObservados}. ` +
          `Con ${meses(faltan)} más aparece la proyección.`,
        hayRespuesta: false,
      };
    }

    case "improbable":
      return {
        titular: `A este ritmo, no en ${meses(p.horizonteMeses)}`,
        detalle:
          p.excedenteMediano <= 0
            ? "En un mes típico no te sobra nada, así que el ahorro no avanza."
            : "El excedente que te queda al mes no alcanza para llegar dentro del plazo que se proyecta.",
        hayRespuesta: false,
      };

    case "proyectada":
      return {
        titular: `${meses(p.mesesP80!)} con 80% de probabilidad`,
        detalle:
          p.mesesP95 !== null
            ? `${meses(p.mesesP50!)} si todo sale bien · ${meses(p.mesesP95!)} para estar casi seguro.`
            : `${meses(p.mesesP50!)} si todo sale bien.`,
        hayRespuesta: true,
      };
  }
}

/**
 * Qué tan realista es el plazo que la persona se propuso.
 *
 * Es la pregunta que de verdad se hace quien pone una fecha: no "cuándo
 * llego" sino "¿llego a tiempo?". Responderla con un porcentaje a secas no
 * sirve de nada, así que se traduce a lenguaje corriente.
 */
export function describirPlazoPropuesto(p: Proyeccion): string | null {
  if (p.probabilidadALaFecha === null) return null;

  const porcentaje = Math.round(p.probabilidadALaFecha * 100);
  if (porcentaje >= 90) return `Llegas a la fecha que te propusiste: ${porcentaje}% de probabilidad.`;
  if (porcentaje >= 60) return `Puede que llegues a esa fecha: ${porcentaje}% de probabilidad.`;
  if (porcentaje >= 20) return `Es difícil que llegues a esa fecha: ${porcentaje}% de probabilidad.`;
  return `Esa fecha no es realista con lo que te sobra hoy: ${porcentaje}% de probabilidad.`;
}

/** Cuánto falta reunir. Nunca negativo. */
export function faltaPara(meta: Meta): number {
  return Math.max(0, meta.montoObjetivo - meta.montoAhorrado);
}
