/**
 * Sugerencias de categoría para movimientos que el sistema no pudo clasificar.
 *
 * Es la **primera capa de la cascada** del clasificador (tarea E2): reglas por
 * palabra clave sobre la glosa que manda el banco. Resuelve los comercios
 * conocidos sin necesidad de modelo, que es lo barato y lo seguro.
 *
 * Lo que NO hace: adivinar. Si ninguna regla calza, no inventa una categoría;
 * ofrece las que el usuario más usa y lo deja decidir. Un dato inventado es
 * peor que un dato ausente (RNF-33).
 *
 * PENDIENTE: cuando exista el modelo entrenado (bloque E), estas reglas siguen
 * siendo la primera capa y el modelo atiende lo que ellas no resuelven. Las
 * correcciones del usuario alimentan el reentrenamiento.
 */
import type { Movimiento } from "@/modelo/tipos";

/** Reglas por palabra clave. El orden importa: gana la primera que calza. */
const REGLAS: { patron: RegExp; categoria: string }[] = [
  { patron: /\b(CGE|ENEL|SAESA)\b/i, categoria: "Servicios" },
  { patron: /\b(ESSAL|AGUAS|ESVAL)\b/i, categoria: "Servicios" },
  { patron: /\b(ABASTIBLE|LIPIGAS|GASCO)\b/i, categoria: "Servicios" },
  { patron: /SERVIPAG/i, categoria: "Servicios" },
  { patron: /\bSERV\b/i, categoria: "Servicios" },
  { patron: /(SPOTIFY|NETFLIX|DISNEY|HBO|PRIME)/i, categoria: "Entretención" },
  { patron: /(UBER|CABIFY|DIDI)\s*EATS|RAPPI|PEDIDOSYA/i, categoria: "Delivery" },
  { patron: /(COPEC|SHELL|PETROBRAS|UBER|CABIFY|DIDI|METRO)/i, categoria: "Transporte" },
  { patron: /(LIDER|JUMBO|UNIMARC|SANTA ISABEL|TOTTUS|ACUENTA)/i, categoria: "Supermercado" },
  { patron: /(FARMACIA|AHUMADA|CRUZ VERDE|SALCOBRAND)/i, categoria: "Salud" },
];

/** Categorías que el usuario más usa, de mayor a menor. */
function masUsadas(movimientos: Movimiento[], cuantas: number): string[] {
  const conteo = new Map<string, number>();
  for (const m of movimientos) {
    if (!m.categoria || m.monto >= 0) continue;
    conteo.set(m.categoria, (conteo.get(m.categoria) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cuantas)
    .map(([categoria]) => categoria);
}

export type Sugerencia = {
  categorias: string[];
  /**
   * true cuando una regla reconoció la glosa. false cuando no se reconoció
   * nada y lo ofrecido son solo las categorías que el usuario más usa.
   *
   * La interfaz lo usa para NO destacar una opción cuando el sistema no sabe:
   * presentar un dato inventado como si fuera una certeza es peor que no
   * ofrecer nada (RNF-33).
   */
  porRegla: boolean;
};

/**
 * Hasta `cuantas` categorías sugeridas para un movimiento sin clasificar.
 *
 * Primero lo que dicen las reglas sobre su glosa, después la categoría que el
 * banco mandó (si mandó alguna), y por último las que el usuario más usa.
 */
export function sugerirCategorias(
  movimiento: Movimiento,
  todos: Movimiento[],
  cuantas = 2,
): Sugerencia {
  const texto = `${movimiento.glosaOriginal} ${movimiento.comercio ?? ""}`;
  const categorias: string[] = [];

  const agregar = (categoria: string | null) => {
    if (categoria && !categorias.includes(categoria)) categorias.push(categoria);
  };

  for (const regla of REGLAS) {
    if (regla.patron.test(texto)) agregar(regla.categoria);
    if (categorias.length >= cuantas) return { categorias, porRegla: true };
  }

  const porRegla = categorias.length > 0 || movimiento.categoriaBanco !== null;
  agregar(movimiento.categoriaBanco);

  for (const categoria of masUsadas(todos, cuantas + 2)) {
    agregar(categoria);
    if (categorias.length >= cuantas) break;
  }

  return { categorias: categorias.slice(0, cuantas), porRegla };
}

/** Todas las categorías que el usuario ya tiene en uso, ordenadas. */
export function categoriasEnUso(movimientos: Movimiento[]): string[] {
  const conjunto = new Set<string>();
  for (const m of movimientos) {
    if (m.categoria && m.monto < 0) conjunto.add(m.categoria);
  }
  return [...conjunto].sort();
}

/**
 * Porcentaje de movimientos que el sistema clasificó **por sí solo**.
 *
 * Cuenta solo `estadoCategoria === "automatica"`: las correcciones del usuario
 * quedan fuera a propósito. Si contaran, la métrica subiría justo con los
 * casos que el clasificador NO supo resolver, que es lo contrario de lo que
 * hay que medir. Es la cifra que el reentrenamiento debe mejorar (E6).
 */
export function coberturaAutomatica(movimientos: Movimiento[]): number {
  const cargos = movimientos.filter((m) => m.monto < 0);
  if (cargos.length === 0) return 100;
  const automaticos = cargos.filter((m) => m.estadoCategoria === "automatica").length;
  return Math.round((automaticos / cargos.length) * 100);
}
