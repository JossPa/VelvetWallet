/**
 * Los movimientos del usuario, como estado compartido.
 *
 * Se cargan desde el backend cuando el usuario inicia sesión (solo los suyos) y
 * se limpian cuando cierra sesión. Antes se partía de un archivo local igual
 * para todos; ahora cada usuario ve únicamente su propia información.
 *
 * Al recibir los datos se corre la PRIMERA CAPA del clasificador (reglas por
 * palabra clave, ver utils/sugerencias). El backend todavía no categoriza, así
 * que esto vive en la app de forma provisional: cuando el clasificador exista
 * en el backend, la categoría llegará ya puesta y este paso se quita.
 *
 * `novedades` guarda qué cambió en la última sincronización para que la lista
 * pueda destacarlo. Se limpia cuando el usuario las mira.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { Correccion, Movimiento } from "@/modelo/tipos";
import { conectarBanco, obtenerMovimientos } from "@/servicios/sincronizacion";
import { useSesion } from "@/sesion/SesionContexto";
import { clasificarPorReglas } from "@/utils/sugerencias";
import { fusionar } from "@/utils/fusion";

export type Novedades = {
  nuevos: string[];
  /** id → monto que tenía antes de actualizarse. */
  actualizados: Record<string, number>;
};

const SIN_NOVEDADES: Novedades = { nuevos: [], actualizados: {} };

/**
 * Clasificación automática por reglas sobre lo que llega del backend.
 *
 * Solo toca los cargos sin categoría: si una regla reconoce el comercio le pone
 * la categoría y marca `estadoCategoria: "automatica"`. Lo que ninguna regla
 * reconoce queda sin categorizar (el sistema se abstiene) y aparece en
 * "Por revisar". Nunca pisa una corrección del usuario.
 */
function clasificar(lista: Movimiento[]): Movimiento[] {
  return lista.map((m) => {
    if (m.categoria !== null) return m;
    const categoria = clasificarPorReglas(m);
    return categoria ? { ...m, categoria, estadoCategoria: "automatica" as const } : m;
  });
}

type ValorMovimientos = {
  movimientos: Movimiento[];
  novedades: Novedades;
  sincronizando: boolean;
  ultimaSincronizacion: string | null;
  error: string | null;
  /** Vuelve a consultar el backend y fusiona. Devuelve cuántos cambiaron. */
  sincronizar: () => Promise<{ nuevos: number; actualizados: number }>;
  /** Vincula un banco (la petición de permiso del usuario) y carga sus datos. */
  conectar: () => Promise<void>;
  /** Asigna o corrige la categoría de un movimiento (el usuario en "Por revisar"). */
  corregirCategoria: (id: string, categoria: string) => void;
  /** Apaga el destacado y el contador de la pestaña. */
  marcarVistas: () => void;
};

const Contexto = createContext<ValorMovimientos | null>(null);

export function ProveedorMovimientos({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  // Espejo de `movimientos` para fusionar sin depender de cuándo React aplique
  // el cambio de estado.
  const actualesRef = useRef<Movimiento[]>([]);
  const [novedades, setNovedades] = useState<Novedades>(SIN_NOVEDADES);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSincronizacion, setUltima] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reemplazar = useCallback((lista: Movimiento[]) => {
    actualesRef.current = lista;
    setMovimientos(lista);
  }, []);

  // Carga inicial de los datos del usuario al entrar; limpieza al salir.
  useEffect(() => {
    let vivo = true;

    if (!usuario) {
      reemplazar([]);
      setNovedades(SIN_NOVEDADES);
      setUltima(null);
      setError(null);
      return;
    }

    setSincronizando(true);
    setError(null);
    obtenerMovimientos()
      .then((lista) => {
        if (!vivo) return;
        reemplazar(clasificar(lista));
        setUltima(new Date().toISOString());
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
      })
      .finally(() => {
        if (vivo) setSincronizando(false);
      });

    return () => {
      vivo = false;
    };
  }, [usuario?.id, reemplazar]);

  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    setError(null);
    try {
      // Vuelve a pedir al banco (re-corre la ingesta): así llegan los
      // movimientos nuevos que el banco generó desde la última vez.
      await conectarBanco();
      const entrantes = clasificar(await obtenerMovimientos());

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

  const conectar = useCallback(async () => {
    setSincronizando(true);
    setError(null);
    try {
      await conectarBanco();                      // el usuario pide el permiso (consentimiento)
      const lista = clasificar(await obtenerMovimientos());  // y cargamos lo que llegó
      reemplazar(lista);
      setUltima(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar el banco.");
      throw e;
    } finally {
      setSincronizando(false);
    }
  }, [reemplazar]);

  // El usuario asigna o corrige una categoría en "Por revisar". Se guarda la
  // corrección aparte (el dato del banco no se toca) y la categoría pasa a
  // estado "corregida". Es estado local: alimentaría el reentrenamiento del
  // clasificador cuando el backend persista las correcciones.
  const corregirCategoria = useCallback((id: string, categoria: string) => {
    const correccion: Correccion = {
      tipo: "recategorizar",
      fecha: new Date().toISOString(),
      detalle: categoria,
    };
    const aplicar = (lista: Movimiento[]) =>
      lista.map((m) =>
        m.id === id
          ? {
              ...m,
              categoria,
              estadoCategoria: "corregida" as const,
              correcciones: [...m.correcciones, correccion],
            }
          : m,
      );
    actualesRef.current = aplicar(actualesRef.current);
    setMovimientos(actualesRef.current);
  }, []);

  const marcarVistas = useCallback(() => setNovedades(SIN_NOVEDADES), []);

  const valor = useMemo(
    () => ({
      movimientos,
      novedades,
      sincronizando,
      ultimaSincronizacion,
      error,
      sincronizar,
      conectar,
      corregirCategoria,
      marcarVistas,
    }),
    [movimientos, novedades, sincronizando, ultimaSincronizacion, error, sincronizar, conectar, corregirCategoria, marcarVistas],
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
