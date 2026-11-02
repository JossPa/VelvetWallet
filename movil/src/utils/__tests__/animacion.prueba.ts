/**
 * Pruebas de las curvas de animación.
 *
 * Lo que de verdad importa acá es el borde: que una cifra animada aterrice en
 * el valor exacto. Si `interpolar` arrastra error de punto flotante, el
 * disponible del mes queda a un peso del real y la app pierde credibilidad por
 * un detalle de presentación.
 */
import { avance, interpolar, retraso, salidaSuave } from "@/utils/animacion";

describe("salidaSuave", () => {
  it("empieza en cero y termina en uno", () => {
    expect(salidaSuave(0)).toBe(0);
    expect(salidaSuave(1)).toBe(1);
  });

  it("recorta los valores fuera de rango, por si el reloj entrega un cuadro tarde", () => {
    expect(salidaSuave(-0.5)).toBe(0);
    expect(salidaSuave(1.4)).toBe(1);
  });

  it("frena al llegar: avanza más en la primera mitad que en la segunda", () => {
    const primera = salidaSuave(0.5) - salidaSuave(0);
    const segunda = salidaSuave(1) - salidaSuave(0.5);

    expect(primera).toBeGreaterThan(segunda);
  });

  it("nunca retrocede", () => {
    let previo = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = salidaSuave(t);
      expect(v).toBeGreaterThanOrEqual(previo);
      previo = v;
    }
  });
});

describe("interpolar", () => {
  it("devuelve el extremo exacto en los bordes", () => {
    expect(interpolar(0, 910_332, 0)).toBe(0);
    expect(interpolar(0, 910_332, 1)).toBe(910_332);
  });

  it("aterriza exacto aunque el número sea feo para el punto flotante", () => {
    expect(interpolar(0, 0.1 + 0.2, 1)).toBe(0.1 + 0.2);
    expect(interpolar(386_053, 910_332, 1)).toBe(910_332);
  });

  it("va a la mitad en la mitad", () => {
    expect(interpolar(0, 100, 0.5)).toBe(50);
  });

  it("funciona hacia abajo y en negativo", () => {
    expect(interpolar(100, -60_332, 1)).toBe(-60_332);
    expect(interpolar(0, -100, 0.25)).toBe(-25);
  });
});

describe("avance", () => {
  it("va de cero a uno a lo largo de la duración", () => {
    expect(avance(1000, 1000, 400)).toBe(0);
    expect(avance(1200, 1000, 400)).toBe(0.5);
    expect(avance(1400, 1000, 400)).toBe(1);
  });

  it("no se pasa de uno si el cuadro llega tarde", () => {
    expect(avance(9999, 1000, 400)).toBe(1);
  });

  it("duración cero salta al final, para apagar el movimiento sin otro camino", () => {
    expect(avance(0, 1000, 0)).toBe(1);
  });
});

describe("retraso", () => {
  it("escalona los primeros elementos", () => {
    expect(retraso(0, 55)).toBe(0);
    expect(retraso(2, 55)).toBe(110);
  });

  it("topa, para que una lista larga no haga esperar a la interfaz", () => {
    expect(retraso(30, 55, 6)).toBe(330);
  });
});
