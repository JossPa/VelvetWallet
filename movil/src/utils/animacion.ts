/**
 * Las matemáticas del movimiento, separadas de los componentes.
 *
 * Están acá y no dentro de la vista por la misma razón que el desglose: una
 * curva de animación es una función pura, se puede probar, y si vive en el
 * componente no la prueba nadie. Lo que importa verificar es el borde —que
 * termine exactamente en el valor pedido y no en 999.998— porque una cifra
 * financiera que se queda a un peso del total no es un detalle estético.
 */

/**
 * Curva de salida suave (cúbica).
 *
 * Arranca rápido y frena al llegar. Es la curva de casi todo movimiento de
 * interfaz: imita que el elemento tenía inercia y se detuvo, en vez de
 * aparecer a velocidad constante como una barra de progreso.
 *
 * `t` va de 0 a 1 y se recorta fuera de ese rango, porque el reloj del
 * navegador puede entregar un cuadro tarde y pasarse de 1.
 */
export function salidaSuave(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Valor intermedio entre dos números según el avance `t` (0 a 1).
 *
 * En `t = 1` devuelve `hasta` exacto, sin arrastrar error de punto flotante:
 * es la garantía de que la cifra animada aterriza en el número de verdad.
 */
export function interpolar(desde: number, hasta: number, t: number): number {
  if (t <= 0) return desde;
  if (t >= 1) return hasta;
  return desde + (hasta - desde) * t;
}

/**
 * Avance de una animación que empezó en `inicio` y dura `duracion` ms.
 * Duración cero (o negativa) salta directo al final: así, apagar el
 * movimiento no requiere un camino de código aparte.
 */
export function avance(ahora: number, inicio: number, duracion: number): number {
  if (duracion <= 0) return 1;
  return Math.min(1, Math.max(0, (ahora - inicio) / duracion));
}

/**
 * Retraso de un elemento dentro de una entrada escalonada, con tope.
 *
 * Sin tope, una lista de treinta filas tardaría casi dos segundos en terminar
 * de aparecer y el usuario esperaría a la interfaz. El tope convierte el
 * escalonado en un detalle de los primeros elementos, que es donde se nota.
 */
export function retraso(indice: number, escalon: number, tope = 6): number {
  return Math.min(indice, tope) * escalon;
}
