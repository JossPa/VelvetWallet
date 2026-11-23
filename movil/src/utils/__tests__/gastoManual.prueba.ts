/**
 * Pruebas del formulario de gasto en efectivo (RF-13).
 *
 * Lo delicado es la fecha: se escribe día-mes-año, tiene que existir, no puede
 * ser futura, y se arma con la fecha LOCAL. Con la UTC, un gasto anotado a las
 * 22:00 en Chile quedaría registrado al día siguiente.
 */
import {
  CATEGORIAS_GASTO,
  aFechaIso,
  categoriasParaElegir,
  haceDias,
  leerFecha,
  leerMonto,
} from "@/utils/gastoManual";

import { movimiento } from "./ayuda";

// 4 de noviembre de 2026, 22:30 hora local.
const AHORA = new Date(2026, 10, 4, 22, 30);

describe("leerMonto", () => {
  it("acepta el monto con puntos, signo peso o sin nada", () => {
    expect(leerMonto("4.500")).toBe(4500);
    expect(leerMonto("$4500")).toBe(4500);
    expect(leerMonto("4500")).toBe(4500);
  });

  it("rechaza vacío, cero y montos absurdos", () => {
    expect(leerMonto("")).toBeNull();
    expect(leerMonto("abc")).toBeNull();
    expect(leerMonto("0")).toBeNull();
    expect(leerMonto("500000000")).toBeNull();
  });
});

describe("fechas", () => {
  it("usa la fecha local, no la UTC", () => {
    // A las 22:30 en Chile ya es el día siguiente en UTC.
    expect(aFechaIso(AHORA)).toBe("2026-11-04");
  });

  it("haceDias cuenta hacia atrás cruzando el mes", () => {
    expect(haceDias(0, AHORA)).toBe("2026-11-04");
    expect(haceDias(1, AHORA)).toBe("2026-11-03");
    expect(haceDias(4, AHORA)).toBe("2026-10-31");
  });

  it("lee día-mes-año con guion, barra o punto", () => {
    expect(leerFecha("15-10-2026", AHORA)).toBe("2026-10-15");
    expect(leerFecha("1/9/2026", AHORA)).toBe("2026-09-01");
    expect(leerFecha(" 03.11.2026 ", AHORA)).toBe("2026-11-03");
  });

  it("acepta hoy pero no mañana", () => {
    expect(leerFecha("04-11-2026", AHORA)).toBe("2026-11-04");
    expect(leerFecha("05-11-2026", AHORA)).toBeNull();
  });

  it("rechaza fechas que no existen o mal escritas", () => {
    expect(leerFecha("31-02-2026", AHORA)).toBeNull();
    expect(leerFecha("2026-10-15", AHORA)).toBeNull();
    expect(leerFecha("15-13-2026", AHORA)).toBeNull();
    expect(leerFecha("15-10-1999", AHORA)).toBeNull();
    expect(leerFecha("", AHORA)).toBeNull();
  });
});

describe("categoriasParaElegir", () => {
  it("sin historial ofrece la lista de Velvet completa", () => {
    expect(categoriasParaElegir([])).toEqual(CATEGORIAS_GASTO);
  });

  it("pone primero las que más usa la persona, sin repetirlas", () => {
    const historial = [
      movimiento({ categoria: "Transporte" }),
      movimiento({ categoria: "Transporte" }),
      movimiento({ categoria: "Delivery" }),
    ];
    const lista = categoriasParaElegir(historial);
    expect(lista.slice(0, 2)).toEqual(["Transporte", "Delivery"]);
    expect(lista.filter((c) => c === "Transporte")).toHaveLength(1);
    expect(lista).toHaveLength(CATEGORIAS_GASTO.length);
  });

  it("incluye las categorías propias y no cuenta los abonos", () => {
    const historial = [
      ...Array.from({ length: 5 }, () => movimiento({ categoria: "Supermercado" })),
      ...Array.from({ length: 4 }, () => movimiento({ categoria: "Transporte" })),
      ...Array.from({ length: 3 }, () => movimiento({ categoria: "Salud" })),
      ...Array.from({ length: 2 }, () => movimiento({ categoria: "Delivery" })),
      movimiento({ categoria: "Mascotas" }),
      movimiento({ categoria: "Sueldo", monto: 900_000 }),
    ];
    const lista = categoriasParaElegir(historial);
    expect(lista).toContain("Mascotas");
    expect(lista).not.toContain("Sueldo");
    expect(lista[lista.length - 1]).toBe("Mascotas");
  });
});
