/**
 * Los movimientos, como estado compartido que puede cambiar.
 *
 * Antes eran un archivo fijo que se cargaba al arrancar. Ahora arrancan de ahí
 * —el historial de doce meses— y la sincronización trae lo nuevo encima.
 *
 * `novedades` guarda qué cambió en la última sincronización para que la lista
 * pueda destacarlo. Se limpia cuando el usuario las mira.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { MOVIMIENTOS_INICIALES } from "@/datos/movimientos";
import type { Movimiento } from "@/modelo/tipos";
import { obtenerMovimientos } from "@/servicios/sincronizacion";
import { fusionar } from "@/utils/fusion";

export type Novedades = {
  nuevos: string[];
  /** id → monto que tenía antes de actualizarse. */
  actualizados: Record<string, number>;
};

const SIN_NOVEDADES: Novedades = { nuevos: [], actualizados: {} };

type ValorMovimientos = {
  movimientos: Movimiento[];
  novedades: Novedades;
  sincronizando: boolean;
  ultimaSincronizacion: string | null;
  error: string | null;
  /** Consulta la institución y fusiona. Devuelve cuántos cambiaron. */
  sincronizar: () => Promise<{ nuevos: number; actualizados: number }>;
  /** Apaga el destacado y el contador de la pestaña. */
  marcarVistas: () => void;
};

const Contexto = createContext<ValorMovimientos | null>(null);

export function ProveedorMovimientos({ children }: { children: ReactNode }) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>(MOVIMIENTOS_INICIALES);
  // Espejo de `movimientos` para fusionar sin depender de cuándo React aplique
  // el cambio de estado: la fusión necesita la lista actual en el mismo
  // instante, y el resumen se devuelve a quien llamó.
  const actualesRef = useRef<Movimiento[]>(MOVIMIENTOS_INICIALES);
  const [novedades, setNovedades] = useState<Novedades>(SIN_NOVEDADES);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSincronizacion, setUltima] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    setError(null);
    try {
      // Se pide el mes en curso, no el historial completo: sincronización
      // incremental. El backend hará lo mismo con la última fecha sincronizada.
      const desde = new Date();
      desde.setDate(1);
      const entrantes = await obtenerMovimientos(desde.toISOString());

      const r = fusionar(actualesRef.current, entrantes);
      actualesRef.current = r.movimientos;
      setMovimientos(r.movimientos);

      if (r.nuevos.length > 0 || r.actualizados.length > 0) {
        setNovedades((previas) => ({
          nuevos: [...new Set([...previas.nuevos, ...r.nuevos])],
          actualizados: {
            ...previas.actualizados,
            ...Object.fromEntries(r.actualizados.map((a) => [a.id, a.montoAnterior])),
          },
        }));
      }

      setUltima(new Date().toISOString());
      return { nuevos: r.nuevos.length, actualizados: r.actualizados.length };
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo sincronizar.");
      throw e;
    } finally {
      setSincronizando(false);
    }
  }, []);

  const marcarVistas = useCallback(() => setNovedades(SIN_NOVEDADES), []);

  const valor = useMemo(
    () => ({ movimientos, novedades, sincronizando, ultimaSincronizacion, error, sincronizar, marcarVistas }),
    [movimientos, novedades, sincronizando, ultimaSincronizacion, error, sincronizar, marcarVistas],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMovimientos(): ValorMovimientos {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useMovimientos se usó fuera de ProveedorMovimientos");
  return valor;
}

/** Cantidad de novedades sin mirar, para el contador de la pestaña. */
export function contarNovedades(n: Novedades): number {
  return n.nuevos.length + Object.keys(n.actualizados).length;
}
