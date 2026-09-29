/**
 * Pruebas de la fusión — el upsert de la sincronización.
 *
 * Son las más importantes del proyecto: acá está el caso que rompe las
 * aplicaciones de finanzas. El estándar SFA no tiene campo de pendiente o
 * confirmada, así que una compra confirmada reaparece con el mismo
 * transactionID y otro monto. Insertar por llegada duplicaría el gasto y
 * dejaría el total del usuario mal.
 */
import { fusionar } from "@/utils/fusion";

import { movimiento, sinCategoria } from "./ayuda";

describe("fusionar", () => {
  it("inserta un movimiento cuyo identificador no existía", () => {
    const guardados = [movimiento({ id: "TXN-A" })];
    const entrantes = [movimiento({ id: "TXN-B" })];

    const r = fusionar(guardados, entrantes);

    expect(r.movimientos).toHaveLength(2);
    expect(r.nuevos).toEqual(["TXN-B"]);
    expect(r.actualizados).toHaveLength(0);
  });

  it("actualiza sin duplicar cuando el mismo identificador llega con otro monto", () => {
    const guardados = [movimiento({ id: "TXN-A", monto: -29_908 })];
    const entrantes = [movimiento({ id: "TXN-A", monto: -34_366 })];

    const r = fusionar(guardados, entrantes);

    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0].monto).toBe(-34_366);
    expect(r.nuevos).toHaveLength(0);
    expect(r.actualizados).toEqual([{ id: "TXN-A", montoAnterior: -29_908 }]);
  });

  it("no reporta cambios cuando el movimiento llega igual", () => {
    const guardados = [movimiento({ id: "TXN-A", monto: -10_000 })];
    const entrantes = [movimiento({ id: "TXN-A", monto: -10_000 })];

    const r = fusionar(guardados, entrantes);

    expect(r.nuevos).toHaveLength(0);
    expect(r.actualizados).toHaveLength(0);
  });

  it("sincronizar dos veces seguidas no duplica nada", () => {
    const entrantes = [movimiento({ id: "TXN-A" }), movimiento({ id: "TXN-B" })];

    const primera = fusionar([], entrantes);
    const segunda = fusionar(primera.movimientos, entrantes);

    expect(primera.movimientos).toHaveLength(2);
    expect(segunda.movimientos).toHaveLength(2);
    expect(segunda.nuevos).toHaveLength(0);
  });

  it("conserva la categoría que corrigió el usuario aunque el banco mande la suya (RF-14)", () => {
    const guardados = [
      movimiento({
        id: "TXN-A",
        monto: -24_695,
        categoria: "Servicios",
        estadoCategoria: "corregida",
        correcciones: [{ tipo: "recategorizar", fecha: "2026-09-29T10:00:00.000Z", detalle: "Servicios" }],
      }),
    ];
    // El banco reenvía el mismo movimiento con otro monto y sin categoría.
    const entrantes = [sinCategoria({ id: "TXN-A", monto: -28_399 })];

    const r = fusionar(guardados, entrantes);

    expect(r.movimientos[0].monto).toBe(-28_399);          // toma el monto nuevo
    expect(r.movimientos[0].categoria).toBe("Servicios");  // respeta la corrección
    expect(r.movimientos[0].estadoCategoria).toBe("corregida");
    expect(r.movimientos[0].correcciones).toHaveLength(1);
  });

  it("conserva que el usuario excluyó el movimiento del gasto", () => {
    const guardados = [movimiento({ id: "TXN-A", monto: -120_000, excluido: true })];
    const entrantes = [movimiento({ id: "TXN-A", monto: -125_000, excluido: false })];

    const r = fusionar(guardados, entrantes);

    expect(r.movimientos[0].excluido).toBe(true);
  });

  it("mantiene la primera fecha de recepción para la trazabilidad", () => {
    const guardados = [movimiento({ id: "TXN-A", monto: -1_000, recibidoEn: "2026-09-01T23:10:00.000Z" })];
    const entrantes = [movimiento({ id: "TXN-A", monto: -2_000, recibidoEn: "2026-09-29T23:10:00.000Z" })];

    const r = fusionar(guardados, entrantes);

    expect(r.movimientos[0].recibidoEn).toBe("2026-09-01T23:10:00.000Z");
  });

  it("deja la lista ordenada del más reciente al más antiguo", () => {
    const guardados = [movimiento({ id: "VIEJO", fecha: "2026-09-01T12:00:00.000Z" })];
    const entrantes = [movimiento({ id: "NUEVO", fecha: "2026-09-28T12:00:00.000Z" })];

    const r = fusionar(guardados, entrantes);

    expect(r.movimientos.map((m) => m.id)).toEqual(["NUEVO", "VIEJO"]);
  });

  it("si el banco manda el mismo movimiento dos veces en una respuesta, queda uno solo", () => {
    const entrantes = [movimiento({ id: "TXN-A", monto: -5_000 }), movimiento({ id: "TXN-A", monto: -5_000 })];

    const r = fusionar([], entrantes);

    expect(r.movimientos).toHaveLength(1);
  });
});
