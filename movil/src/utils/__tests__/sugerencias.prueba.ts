/**
 * Pruebas de las sugerencias de categoría — la primera capa del clasificador.
 *
 * Lo que más importa probar acá no es que acierte, sino que **declare cuándo
 * no sabe**: la interfaz usa `porRegla` para decidir si destaca una opción, y
 * presentar una suposición como certeza es justo lo que el proyecto dice no
 * hacer (RNF-33).
 */
import { categoriasEnUso, coberturaAutomatica, sugerirCategorias } from "@/utils/sugerencias";

import { movimiento, sinCategoria } from "./ayuda";

const HISTORIAL = [
  movimiento({ categoria: "Supermercado" }),
  movimiento({ categoria: "Supermercado" }),
  movimiento({ categoria: "Servicios" }),
  movimiento({ categoria: "Transporte" }),
];

describe("sugerirCategorias", () => {
  it("reconoce la empresa de electricidad dentro de una glosa sucia", () => {
    const m = sinCategoria({ glosaOriginal: "SERVIPAG CGE 0092" });

    const r = sugerirCategorias(m, HISTORIAL);

    expect(r.categorias[0]).toBe("Servicios");
    expect(r.porRegla).toBe(true);
  });

  it("reconoce un servicio de suscripción", () => {
    const r = sugerirCategorias(sinCategoria({ glosaOriginal: "SPA 8829 *SPOTIFY" }), HISTORIAL);

    expect(r.categorias[0]).toBe("Entretención");
    expect(r.porRegla).toBe(true);
  });

  it("reconoce un supermercado", () => {
    const r = sugerirCategorias(sinCategoria({ glosaOriginal: "UNIMARC PTO MONTT" }), HISTORIAL);

    expect(r.categorias[0]).toBe("Supermercado");
    expect(r.porRegla).toBe(true);
  });

  it("declara que NO sabe cuando ninguna regla reconoce la glosa", () => {
    const r = sugerirCategorias(sinCategoria({ glosaOriginal: "TRANSBANK*CL 8829" }), HISTORIAL);

    expect(r.porRegla).toBe(false);
  });

  it("cuando no sabe, ofrece las categorías que el usuario más usa", () => {
    const r = sugerirCategorias(sinCategoria({ glosaOriginal: "XYZ 0001" }), HISTORIAL);

    expect(r.categorias[0]).toBe("Supermercado"); // la más frecuente del historial
    expect(r.categorias).toHaveLength(2);
  });

  it("usa la categoría del banco cuando viene y no hay regla", () => {
    const m = sinCategoria({ glosaOriginal: "XYZ 0001", categoriaBanco: "Alimentos" });

    const r = sugerirCategorias(m, HISTORIAL);

    expect(r.categorias[0]).toBe("Alimentos");
    expect(r.porRegla).toBe(true);
  });

  it("no repite la misma categoría dos veces", () => {
    const m = sinCategoria({ glosaOriginal: "SERVIPAG CGE 0092", categoriaBanco: "Servicios" });

    const r = sugerirCategorias(m, HISTORIAL);

    expect(new Set(r.categorias).size).toBe(r.categorias.length);
  });
});

describe("categoriasEnUso", () => {
  it("devuelve las categorías de gasto sin repetir y ordenadas", () => {
    expect(categoriasEnUso(HISTORIAL)).toEqual(["Servicios", "Supermercado", "Transporte"]);
  });

  it("no incluye las de los abonos", () => {
    const conSueldo = [...HISTORIAL, movimiento({ monto: 850_000, categoria: "Sueldo" })];

    expect(categoriasEnUso(conSueldo)).not.toContain("Sueldo");
  });
});

describe("coberturaAutomatica", () => {
  it("cuenta el porcentaje de cargos clasificados por el sistema", () => {
    const movimientos = [
      movimiento({ estadoCategoria: "automatica" }),
      movimiento({ estadoCategoria: "automatica" }),
      movimiento({ estadoCategoria: "automatica" }),
      sinCategoria(),
    ];

    expect(coberturaAutomatica(movimientos)).toBe(75);
  });

  it("NO cuenta las correcciones del usuario como clasificación automática", () => {
    // Si las contara, la métrica subiría justo con los casos que el
    // clasificador no supo resolver, que es lo contrario de lo que se mide.
    const movimientos = [
      movimiento({ estadoCategoria: "automatica" }),
      movimiento({ categoria: "Servicios", estadoCategoria: "corregida" }),
    ];

    expect(coberturaAutomatica(movimientos)).toBe(50);
  });

  it("sin gastos devuelve 100 y no divide por cero", () => {
    expect(coberturaAutomatica([])).toBe(100);
  });
});
