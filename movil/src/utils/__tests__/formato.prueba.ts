/**
 * Pruebas de los formatos: pesos chilenos y fechas en lenguaje natural.
 *
 * Son las funciones que más se usan en toda la aplicación, así que un error
 * acá se ve en todas las pantallas a la vez.
 */
import { claveMes, fechaCorta, fechaLista, hora, nombreMes, pesos, tiempoRelativo } from "@/utils/formato";

describe("pesos", () => {
  it("separa los miles con punto", () => {
    expect(pesos(853_782)).toBe("$853.782");
    expect(pesos(1_234_567)).toBe("$1.234.567");
  });

  it("usa el signo menos tipográfico para los negativos", () => {
    expect(pesos(-184_320)).toBe("−$184.320");
  });

  it("no pone separador bajo mil", () => {
    expect(pesos(990)).toBe("$990");
  });

  it("el cero no lleva signo", () => {
    expect(pesos(0)).toBe("$0");
  });

  it("redondea: en pesos chilenos no hay decimales", () => {
    expect(pesos(29_907.6)).toBe("$29.908");
  });
});

describe("claveMes y nombreMes", () => {
  it("extrae el mes de una fecha ISO", () => {
    expect(claveMes("2026-09-27T11:30:00.000Z")).toBe("2026-09");
  });

  it("rellena con cero los meses de un dígito", () => {
    expect(claveMes("2026-01-05T12:00:00.000Z")).toBe("2026-01");
  });

  it("traduce la clave a nombre con mayúscula inicial", () => {
    expect(nombreMes("2026-09")).toBe("Septiembre");
    expect(nombreMes("2026-12")).toBe("Diciembre");
  });
});

describe("fechaCorta y hora", () => {
  it("escribe el día y el mes abreviado", () => {
    expect(fechaCorta("2026-09-03T12:00:00.000Z")).toBe("3 sep");
  });

  it("escribe la hora con dos dígitos", () => {
    expect(hora("2026-09-03T09:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("tiempoRelativo", () => {
  const ahora = new Date("2026-09-29T15:00:00.000Z");

  it("dice recién cuando pasó menos de un minuto", () => {
    expect(tiempoRelativo("2026-09-29T14:59:30.000Z", ahora)).toBe("recién");
  });

  it("cuenta los minutos dentro de la primera hora", () => {
    expect(tiempoRelativo("2026-09-29T14:48:00.000Z", ahora)).toBe("hace 12 min");
  });

  it("usa singular para una hora", () => {
    expect(tiempoRelativo("2026-09-29T14:00:00.000Z", ahora)).toBe("hace 1 hora");
  });

  it("usa plural desde dos horas", () => {
    expect(tiempoRelativo("2026-09-29T13:00:00.000Z", ahora)).toBe("hace 2 horas");
  });

  it("para fechas viejas escribe el día", () => {
    expect(tiempoRelativo("2026-09-03T12:00:00.000Z", ahora)).toBe("el 3 sep");
  });
});

describe("fechaLista", () => {
  const ahora = new Date("2026-09-29T15:00:00.000Z");

  it("dice hoy para el mismo día", () => {
    expect(fechaLista("2026-09-29T08:00:00.000Z", ahora)).toBe("hoy");
  });

  it("para fechas anteriores escribe día y mes", () => {
    expect(fechaLista("2026-09-20T12:00:00.000Z", ahora)).toBe("20 sep");
  });
});
