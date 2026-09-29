/**
 * Pruebas de los cálculos del resumen: el disponible del mes, el reparto por
 * categoría y la comparación mensual.
 *
 * De estas funciones salen todas las cifras que ve el usuario. Si el
 * disponible está mal, la aplicación entera miente.
 */
import {
  compararConMesAnterior,
  conexionesConProblema,
  mesAnterior,
  repartoPorCategoria,
  resumenDelMes,
  sueldoDetectado,
} from "@/utils/resumen";
import type { Conexion } from "@/modelo/tipos";

import { movimiento, sueldo } from "./ayuda";

const EN_SEPTIEMBRE = "2026-09-15T12:00:00.000Z";
const EN_AGOSTO = "2026-08-15T12:00:00.000Z";

describe("sueldoDetectado", () => {
  it("encuentra el abono categorizado como sueldo", () => {
    const movimientos = [movimiento({ monto: -5_000 }), sueldo({ fecha: EN_SEPTIEMBRE })];

    expect(sueldoDetectado(movimientos)?.monto).toBe(850_000);
  });

  it("devuelve null si no hay ningún sueldo en el historial", () => {
    expect(sueldoDetectado([movimiento({ monto: -5_000 })])).toBeNull();
  });
});

describe("resumenDelMes", () => {
  it("el disponible es el sueldo menos los gastos del mes", () => {
    const movimientos = [
      sueldo({ fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -100_000, fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -50_000, fecha: EN_SEPTIEMBRE }),
    ];

    const r = resumenDelMes(movimientos, "2026-09");

    expect(r.ingresos).toBe(850_000);
    expect(r.gastos).toBe(150_000);
    expect(r.disponible).toBe(700_000);
    expect(r.cantidadGastos).toBe(2);
  });

  it("no cuenta los gastos de otros meses", () => {
    const movimientos = [
      sueldo({ fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -100_000, fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -999_999, fecha: EN_AGOSTO }),
    ];

    expect(resumenDelMes(movimientos, "2026-09").gastos).toBe(100_000);
  });

  it("no cuenta los movimientos que el usuario excluyó del gasto", () => {
    const movimientos = [
      sueldo({ fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -100_000, fecha: EN_SEPTIEMBRE }),
      // Transferencia entre cuentas propias: no es gasto.
      movimiento({ monto: -120_000, fecha: EN_SEPTIEMBRE, excluido: true }),
    ];

    expect(resumenDelMes(movimientos, "2026-09").gastos).toBe(100_000);
  });

  it("el disponible queda negativo cuando se gastó más que el sueldo", () => {
    const movimientos = [sueldo({ fecha: EN_SEPTIEMBRE }), movimiento({ monto: -900_000, fecha: EN_SEPTIEMBRE })];

    expect(resumenDelMes(movimientos, "2026-09").disponible).toBe(-50_000);
  });

  it("detecta el día de pago desde la fecha del sueldo", () => {
    const movimientos = [sueldo({ fecha: "2026-09-30T09:05:00.000Z" })];

    expect(resumenDelMes(movimientos, "2026-09").diaDePago).toBe(30);
  });
});

describe("repartoPorCategoria", () => {
  it("suma por categoría y calcula la fracción de cada una", () => {
    const movimientos = [
      movimiento({ monto: -60_000, categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -20_000, categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -20_000, categoria: "Transporte", fecha: EN_SEPTIEMBRE }),
    ];

    const r = repartoPorCategoria(movimientos, "2026-09");

    expect(r.total).toBe(100_000);
    expect(r.porciones[0]).toMatchObject({ categoria: "Supermercado", monto: 80_000, fraccion: 0.8 });
    expect(r.porciones[1]).toMatchObject({ categoria: "Transporte", monto: 20_000, fraccion: 0.2 });
  });

  it("agrupa en Otros lo que sobra del máximo de porciones", () => {
    const movimientos = ["A", "B", "C", "D"].map((categoria, i) =>
      movimiento({ monto: -(10_000 - i * 1_000), categoria, fecha: EN_SEPTIEMBRE }),
    );

    const r = repartoPorCategoria(movimientos, "2026-09", 2);

    expect(r.porciones.map((p) => p.categoria)).toEqual(["A", "B", "Otros"]);
    expect(r.porciones[2].monto).toBe(8_000 + 7_000);
  });

  it("las fracciones suman uno", () => {
    const movimientos = [
      movimiento({ monto: -33_333, categoria: "A", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -33_333, categoria: "B", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -33_334, categoria: "C", fecha: EN_SEPTIEMBRE }),
    ];

    const suma = repartoPorCategoria(movimientos, "2026-09").porciones.reduce((s, p) => s + p.fraccion, 0);

    expect(suma).toBeCloseTo(1);
  });

  it("los movimientos sin categoría se agrupan bajo Sin categorizar", () => {
    const movimientos = [movimiento({ monto: -10_000, categoria: null, fecha: EN_SEPTIEMBRE })];

    expect(repartoPorCategoria(movimientos, "2026-09").porciones[0].categoria).toBe("Sin categorizar");
  });

  it("un mes sin gastos devuelve el reparto vacío y no divide por cero", () => {
    const r = repartoPorCategoria([sueldo({ fecha: EN_SEPTIEMBRE })], "2026-09");

    expect(r.porciones).toHaveLength(0);
    expect(r.total).toBe(0);
  });
});

describe("mesAnterior", () => {
  it("resta un mes", () => {
    expect(mesAnterior("2026-09")).toBe("2026-08");
  });

  it("en enero retrocede al diciembre del año anterior", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
  });
});

describe("compararConMesAnterior", () => {
  it("calcula el cambio porcentual por categoría", () => {
    const movimientos = [
      movimiento({ monto: -100_000, categoria: "Delivery", fecha: EN_AGOSTO }),
      movimiento({ monto: -140_000, categoria: "Delivery", fecha: EN_SEPTIEMBRE }),
    ];

    const r = compararConMesAnterior(movimientos, "2026-09");

    expect(r?.variaciones[0]).toMatchObject({ categoria: "Delivery", porcentaje: 40 });
    expect(r?.total.porcentaje).toBe(40);
  });

  it("un gasto que bajó da porcentaje negativo", () => {
    const movimientos = [
      movimiento({ monto: -100_000, categoria: "Salud", fecha: EN_AGOSTO }),
      movimiento({ monto: -53_000, categoria: "Salud", fecha: EN_SEPTIEMBRE }),
    ];

    expect(compararConMesAnterior(movimientos, "2026-09")?.variaciones[0].porcentaje).toBe(-47);
  });

  it("devuelve null cuando no hay mes anterior con el que comparar", () => {
    expect(compararConMesAnterior([movimiento({ fecha: EN_SEPTIEMBRE })], "2026-09")).toBeNull();
  });

  it("deja fuera las categorías que no existían el mes anterior, para no dividir por cero", () => {
    const movimientos = [
      movimiento({ monto: -50_000, categoria: "Salud", fecha: EN_AGOSTO }),
      movimiento({ monto: -50_000, categoria: "Salud", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -80_000, categoria: "Vestuario", fecha: EN_SEPTIEMBRE }),
    ];

    const r = compararConMesAnterior(movimientos, "2026-09");

    expect(r?.variaciones.map((v) => v.categoria)).toEqual(["Salud"]);
  });
});

describe("conexionesConProblema", () => {
  const conexion = (estado: Conexion["estado"]): Conexion => ({
    id: estado,
    institucion: "Banco",
    estado,
    ultimaSincronizacion: EN_SEPTIEMBRE,
    cuentas: [],
  });

  it("devuelve las que no están al día", () => {
    const todas = [conexion("al_dia"), conexion("sin_respuesta"), conexion("autorizacion_vencida")];

    expect(conexionesConProblema(todas).map((c) => c.estado)).toEqual([
      "sin_respuesta",
      "autorizacion_vencida",
    ]);
  });
});
