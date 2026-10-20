/**
 * Pruebas de cómo se le cuenta a la persona el resultado de la simulación.
 *
 * El motor vive en el backend y tiene sus propias pruebas. Lo que se verifica
 * acá es lo otro, que falla más seguido de lo que parece: que cuando el motor
 * NO tiene respuesta, la app no invente una. Un "te faltan 8 meses" puesto
 * donde el motor dijo "no sé" es el peor error posible en una app de plata.
 */
import type { Meta, Proyeccion } from "@/modelo/tipos";
import { describirPlazoPropuesto, describirProyeccion, faltaPara } from "@/utils/metas";

function proyeccion(campos: Partial<Proyeccion> = {}): Proyeccion {
  return {
    estado: "proyectada",
    mesesObservados: 11,
    mesesMinimos: 3,
    excedenteMediano: 75_000,
    excedentePeor: -31_000,
    excedenteMejor: 227_000,
    curva: [0, 0.03, 0.13, 0.28, 0.46, 0.62, 0.75, 0.84, 0.9, 0.94, 0.97, 0.98],
    mesesP50: 6,
    mesesP80: 8,
    mesesP95: 11,
    probabilidadALaFecha: null,
    simulaciones: 10_000,
    horizonteMeses: 24,
    ...campos,
  };
}

function meta(campos: Partial<Meta> = {}): Meta {
  return {
    id: "META-1",
    nombre: "Nintendo Switch 2",
    montoObjetivo: 400_000,
    montoAhorrado: 0,
    fechaObjetivo: null,
    creadaEn: "2026-10-20T12:00:00-03:00",
    avance: 0,
    proyeccion: proyeccion(),
    ...campos,
  };
}

describe("describirProyeccion", () => {
  it("informa el plazo del 80%, no el optimista", () => {
    // El del 50% suena mejor y se cumple la mitad de las veces. Informar ese
    // sería prometer de más.
    const r = describirProyeccion(meta());
    expect(r.titular).toBe("8 meses con 80% de probabilidad");
    expect(r.hayRespuesta).toBe(true);
  });

  it("menciona los otros dos plazos en el detalle", () => {
    expect(describirProyeccion(meta()).detalle).toBe(
      "6 meses si todo sale bien · 11 meses para estar casi seguro.",
    );
  });

  it("dice 1 mes en singular", () => {
    const r = describirProyeccion(
      meta({ proyeccion: proyeccion({ mesesP50: 1, mesesP80: 1, mesesP95: 1 }) }),
    );
    expect(r.titular).toBe("1 mes con 80% de probabilidad");
  });

  it("cuando falta historial lo dice y no da ningún plazo", () => {
    const r = describirProyeccion(
      meta({ proyeccion: proyeccion({ estado: "sin_historial", mesesObservados: 1, curva: [] }) }),
    );
    expect(r.hayRespuesta).toBe(false);
    expect(r.titular).toBe("Todavía no se puede proyectar");
    expect(r.detalle).toContain("2 meses más");
    // Lo que no puede pasar: que aparezca un plazo donde no lo hay.
    expect(r.titular).not.toMatch(/\d+ mes(es)? con/);
  });

  it("cuando no alcanza dentro del horizonte no inventa una fecha", () => {
    const r = describirProyeccion(
      meta({
        proyeccion: proyeccion({
          estado: "improbable",
          mesesP50: null,
          mesesP80: null,
          mesesP95: null,
        }),
      }),
    );
    expect(r.hayRespuesta).toBe(false);
    expect(r.titular).toBe("A este ritmo, no en 24 meses");
  });

  it("explica distinto si directamente no sobra nada", () => {
    const r = describirProyeccion(
      meta({
        proyeccion: proyeccion({
          estado: "improbable",
          excedenteMediano: -5_000,
          mesesP50: null,
          mesesP80: null,
          mesesP95: null,
        }),
      }),
    );
    expect(r.detalle).toContain("no te sobra nada");
  });

  it("la meta ya alcanzada no habla de plazos", () => {
    const r = describirProyeccion(
      meta({
        montoAhorrado: 400_000,
        avance: 1,
        proyeccion: proyeccion({ estado: "cumplida", mesesP50: null, mesesP80: null, mesesP95: null }),
      }),
    );
    expect(r.titular).toBe("Ya la alcanzaste");
    expect(r.hayRespuesta).toBe(true);
  });
});

describe("describirPlazoPropuesto", () => {
  it("sin fecha propuesta no dice nada", () => {
    expect(describirPlazoPropuesto(proyeccion())).toBeNull();
  });

  it.each([
    [0.95, "Llegas a la fecha"],
    [0.7, "Puede que llegues"],
    [0.35, "Es difícil que llegues"],
    [0.02, "no es realista"],
  ])("con probabilidad %s el tono cambia", (probabilidad, esperado) => {
    const texto = describirPlazoPropuesto(proyeccion({ probabilidadALaFecha: probabilidad }));
    expect(texto).toContain(esperado);
  });

  it("siempre muestra el porcentaje, no solo el adjetivo", () => {
    expect(describirPlazoPropuesto(proyeccion({ probabilidadALaFecha: 0.02 }))).toContain("2%");
  });
});

describe("faltaPara", () => {
  it("es lo que queda por reunir", () => {
    expect(faltaPara(meta({ montoAhorrado: 250_000 }))).toBe(150_000);
  });

  it("nunca es negativo aunque sobre", () => {
    expect(faltaPara(meta({ montoAhorrado: 500_000 }))).toBe(0);
  });
});
