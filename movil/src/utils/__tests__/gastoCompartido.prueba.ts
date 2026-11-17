/**
 * El mismo caso que prueba el backend (backend/pruebas/test_gasto.py).
 *
 * El asistente conversacional responde con un cálculo escrito en Python
 * (backend/motor/gasto.py) y el dashboard con el de esta app. Si los dos no
 * dieran lo mismo, el chat diría una cifra y la pantalla otra. Este archivo y
 * su par del backend prueban las dos implementaciones contra un único caso,
 * `datos/gasto-compartido.json`: si una cambia de regla, falla su prueba.
 */
import { categoriaMasGrande } from "@/utils/desglose";
import {
  compararConMesAnterior,
  gastoUltimosMeses,
  promedioMensual,
  repartoPorCategoria,
} from "@/utils/resumen";

import { movimiento } from "./ayuda";
import caso from "./datos/gasto-compartido.json";

const movimientos = caso.movimientos.map((m) => movimiento(m));
const { esperado } = caso;

describe("mismas cifras que el backend", () => {
  it("reparte el gasto del mes igual", () => {
    const { porciones, total } = repartoPorCategoria(movimientos, esperado.mes, 99);

    expect(Math.round(total)).toBe(esperado.gasto_total);
    expect(
      Object.fromEntries(
        porciones.map((p) => [p.categoria, { monto: p.monto, porcentaje: Math.round(p.fraccion * 100) }]),
      ),
    ).toEqual(esperado.por_categoria);
  });

  it("elige la misma categoría más grande", () => {
    expect(categoriaMasGrande(movimientos, esperado.mes)?.categoria).toBe(esperado.categoria_mas_grande);
  });

  it("compara con el mes anterior igual, redondeando los ,5 hacia arriba", () => {
    const comparacion = compararConMesAnterior(movimientos, esperado.mes, 99);

    expect(comparacion?.total.porcentaje).toBe(esperado.comparacion.total_cambio_pct);
    expect(
      Object.fromEntries(comparacion!.variaciones.map((v) => [v.categoria, v.porcentaje])),
    ).toEqual(esperado.comparacion.por_categoria);
  });

  it("calcula el mismo promedio mensual que la línea del gráfico", () => {
    // Mediodía local: el mismo día en cualquier zona horaria de Chile.
    const hoy = new Date(`${caso.hoy}T12:00:00`);
    const promedio = promedioMensual(gastoUltimosMeses(movimientos, 6, hoy));

    expect(Math.round(promedio)).toBe(esperado.promedio_mensual_6_meses);
  });
});
