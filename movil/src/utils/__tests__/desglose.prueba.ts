/**
 * Pruebas del desglose de una categoría.
 *
 * Es la respuesta a "en qué se fue, dentro de esto", así que lo que se verifica
 * es que los grupos sumen exactamente el total de la categoría y que el cargo
 * más grande sea el que de verdad lo es. Un desglose cuyas partes no suman el
 * total es peor que no tener desglose: el usuario deja de creerle al panel.
 */
import { categoriaMasGrande, categoriasPrincipales, desglosar } from "@/utils/desglose";

import { movimiento, sinCategoria, sueldo } from "./ayuda";

const EN_SEPTIEMBRE = "2026-09-15T12:00:00-03:00";
const EN_AGOSTO = "2026-08-15T12:00:00-03:00";

describe("categoriaMasGrande", () => {
  it("devuelve la categoría con más gasto y su peso en el total", () => {
    const movimientos = [
      movimiento({ monto: -300_000, categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -100_000, categoria: "Transporte", fecha: EN_SEPTIEMBRE }),
    ];

    expect(categoriaMasGrande(movimientos, "2026-09")).toEqual({
      categoria: "Supermercado",
      monto: 300_000,
      fraccion: 0.75,
    });
  });

  it("suma varios cargos antes de decidir cuál es la categoría más grande", () => {
    const movimientos = [
      // Un solo cargo grande no gana contra tres medianos de otra categoría.
      movimiento({ monto: -90_000, categoria: "Vivienda", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -40_000, categoria: "Delivery", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -40_000, categoria: "Delivery", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -40_000, categoria: "Delivery", fecha: EN_SEPTIEMBRE }),
    ];

    expect(categoriaMasGrande(movimientos, "2026-09")?.categoria).toBe("Delivery");
  });

  it("devuelve null cuando no hay gasto, en vez de una categoría en cero", () => {
    expect(categoriaMasGrande([sueldo({ fecha: EN_SEPTIEMBRE })], "2026-09")).toBeNull();
  });

  it("no cuenta los movimientos excluidos", () => {
    const movimientos = [
      movimiento({ monto: -500_000, categoria: "Transferencias", fecha: EN_SEPTIEMBRE, excluido: true }),
      movimiento({ monto: -50_000, categoria: "Salud", fecha: EN_SEPTIEMBRE }),
    ];

    expect(categoriaMasGrande(movimientos, "2026-09")?.categoria).toBe("Salud");
  });

  it("acumula el período cuando se pasan varios meses", () => {
    const movimientos = [
      movimiento({ monto: -60_000, categoria: "Vivienda", fecha: EN_AGOSTO }),
      movimiento({ monto: -60_000, categoria: "Vivienda", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -100_000, categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
    ];

    expect(categoriaMasGrande(movimientos, new Set(["2026-08", "2026-09"]))?.categoria).toBe("Vivienda");
  });
});

describe("desglosar", () => {
  it("agrupa por comercio, de mayor a menor", () => {
    const movimientos = [
      movimiento({ monto: -20_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -35_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -45_000, comercio: "Jumbo", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
    ];

    const d = desglosar(movimientos, "Supermercado", "2026-09");

    expect(d.total).toBe(100_000);
    expect(d.cantidad).toBe(3);
    expect(d.agrupadoPor).toBe("comercio");
    expect(d.grupos.map((g) => g.nombre)).toEqual(["Lider", "Jumbo"]);
    expect(d.grupos[0]).toMatchObject({ total: 55_000, cantidad: 2, fraccion: 0.55 });
    expect(d.grupos[1]).toMatchObject({ total: 45_000, cantidad: 1, fraccion: 0.45 });
  });

  it("las fracciones de los grupos suman el total de la categoría", () => {
    const movimientos = ["A", "B", "C"].map((comercio, i) =>
      movimiento({ monto: -(11_111 + i), comercio, categoria: "Varios", fecha: EN_SEPTIEMBRE }),
    );

    const d = desglosar(movimientos, "Varios", "2026-09");

    expect(d.grupos.reduce((s, g) => s + g.total, 0)).toBe(d.total);
    expect(d.grupos.reduce((s, g) => s + g.fraccion, 0)).toBeCloseTo(1);
  });

  it("señala el cargo más grande de la categoría", () => {
    const grande = movimiento({
      monto: -78_990,
      comercio: "Jumbo",
      categoria: "Supermercado",
      fecha: EN_SEPTIEMBRE,
    });
    const movimientos = [
      movimiento({ monto: -12_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      grande,
      movimiento({ monto: -8_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
    ];

    expect(desglosar(movimientos, "Supermercado", "2026-09").mayor?.id).toBe(grande.id);
  });

  it("ordena los movimientos del grupo de mayor a menor monto", () => {
    const movimientos = [
      movimiento({ monto: -5_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -50_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -15_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
    ];

    const montos = desglosar(movimientos, "Supermercado", "2026-09").grupos[0].movimientos.map((m) => m.monto);

    expect(montos).toEqual([-50_000, -15_000, -5_000]);
  });

  it("calcula cuánto pesa la categoría en el gasto del período", () => {
    const movimientos = [
      movimiento({ monto: -150_000, categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -50_000, categoria: "Transporte", fecha: EN_SEPTIEMBRE }),
    ];

    expect(desglosar(movimientos, "Supermercado", "2026-09").fraccionDelGasto).toBe(0.75);
  });

  it("deja fuera los abonos, los excluidos y los otros meses", () => {
    const movimientos = [
      movimiento({ monto: -40_000, categoria: "Salud", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -99_000, categoria: "Salud", fecha: EN_SEPTIEMBRE, excluido: true }),
      movimiento({ monto: -88_000, categoria: "Salud", fecha: EN_AGOSTO }),
      sueldo({ fecha: EN_SEPTIEMBRE, categoria: "Salud" }),
    ];

    const d = desglosar(movimientos, "Salud", "2026-09");

    expect(d.total).toBe(40_000);
    expect(d.cantidad).toBe(1);
  });

  it("cuando no hay comercio usa la glosa del banco y lo marca sin identificar", () => {
    const movimientos = [sinCategoria({ monto: -17_500, categoria: "Varios", fecha: EN_SEPTIEMBRE })];

    const grupo = desglosar(movimientos, "Varios", "2026-09").grupos[0];

    expect(grupo.nombre).toBe("PAGO PSP 4471 STGO");
    expect(grupo.sinIdentificar).toBe(true);
  });

  it("un grupo con comercio reconocido no queda marcado sin identificar", () => {
    const movimientos = [movimiento({ monto: -10_000, comercio: "Lider", fecha: EN_SEPTIEMBRE })];

    expect(desglosar(movimientos, "Supermercado", "2026-09").grupos[0].sinIdentificar).toBe(false);
  });

  it("desglosa Sin categorizar como cualquier otra categoría", () => {
    const movimientos = [
      sinCategoria({ monto: -30_000, glosaOriginal: "PAGO PSP 4471 STGO", fecha: EN_SEPTIEMBRE }),
      sinCategoria({ monto: -10_000, glosaOriginal: "COMPRA WEB 221", fecha: EN_SEPTIEMBRE }),
    ];

    const d = desglosar(movimientos, "Sin categorizar", "2026-09");

    expect(d.total).toBe(40_000);
    expect(d.grupos.map((g) => g.nombre)).toEqual(["PAGO PSP 4471 STGO", "COMPRA WEB 221"]);
  });

  it("una categoría sin movimientos devuelve el desglose vacío, sin dividir por cero", () => {
    const d = desglosar([movimiento({ monto: -10_000, fecha: EN_SEPTIEMBRE })], "Mascotas", "2026-09");

    expect(d).toMatchObject({ total: 0, cantidad: 0, fraccionDelGasto: 0, mayor: null, grupos: [] });
  });

  it("acumula el período completo cuando se pasan varios meses", () => {
    const movimientos = [
      movimiento({ monto: -25_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_AGOSTO }),
      movimiento({ monto: -25_000, comercio: "Lider", categoria: "Supermercado", fecha: EN_SEPTIEMBRE }),
    ];

    const d = desglosar(movimientos, "Supermercado", new Set(["2026-08", "2026-09"]));

    expect(d.total).toBe(50_000);
    expect(d.grupos[0].cantidad).toBe(2);
  });
});

describe("desglosar Otros", () => {
  // "Otros" no es una categoría: es el resto que el gráfico agrupa. Lo que
  // falta saber de ahí es qué categorías lo componen, no qué comercios.
  const cola = () => [
    movimiento({ monto: -100_000, categoria: "A", fecha: EN_SEPTIEMBRE }),
    movimiento({ monto: -90_000, categoria: "B", fecha: EN_SEPTIEMBRE }),
    movimiento({ monto: -8_000, categoria: "C", fecha: EN_SEPTIEMBRE }),
    movimiento({ monto: -5_000, categoria: "D", fecha: EN_SEPTIEMBRE }),
    movimiento({ monto: -2_000, categoria: "E", fecha: EN_SEPTIEMBRE }),
  ];

  it("agrupa por categoría, no por comercio", () => {
    const d = desglosar(cola(), "Otros", "2026-09", 2);

    expect(d.agrupadoPor).toBe("categoria");
    expect(d.grupos.map((g) => g.nombre)).toEqual(["C", "D", "E"]);
  });

  it("su total es exactamente lo que el gráfico agrupó en Otros", () => {
    const d = desglosar(cola(), "Otros", "2026-09", 2);

    expect(d.total).toBe(8_000 + 5_000 + 2_000);
    expect(d.cantidad).toBe(3);
  });

  it("ningún grupo de Otros queda marcado sin identificar: son categorías", () => {
    const movimientos = [
      movimiento({ monto: -100_000, categoria: "A", fecha: EN_SEPTIEMBRE }),
      sinCategoria({ monto: -3_000, fecha: EN_SEPTIEMBRE }),
    ];

    const d = desglosar(movimientos, "Otros", "2026-09", 1);

    expect(d.grupos.map((g) => g.nombre)).toEqual(["Sin categorizar"]);
    expect(d.grupos[0].sinIdentificar).toBe(false);
  });

  it("queda vacío cuando todas las categorías entran en el gráfico", () => {
    const d = desglosar(cola(), "Otros", "2026-09", 5);

    expect(d).toMatchObject({ total: 0, cantidad: 0, mayor: null, grupos: [] });
  });

  it("el cargo más grande de Otros sale de la cola, no del total", () => {
    const d = desglosar(cola(), "Otros", "2026-09", 2);

    expect(d.mayor?.monto).toBe(-8_000);
  });
});

describe("categoriasPrincipales", () => {
  it("devuelve las que el gráfico muestra con nombre propio, de mayor a menor", () => {
    const movimientos = [
      movimiento({ monto: -10_000, categoria: "A", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -30_000, categoria: "B", fecha: EN_SEPTIEMBRE }),
      movimiento({ monto: -20_000, categoria: "C", fecha: EN_SEPTIEMBRE }),
    ];

    expect(categoriasPrincipales(movimientos, "2026-09", 2)).toEqual(["B", "C"]);
  });

  it("sin gasto devuelve lista vacía", () => {
    expect(categoriasPrincipales([], "2026-09")).toEqual([]);
  });
});
