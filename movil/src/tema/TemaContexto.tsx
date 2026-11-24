/**
 * Tema de la app: claro, oscuro o el del sistema.
 *
 * La persona elige en Cuentas › Apariencia. "Sistema" sigue al teléfono (o al
 * navegador) y cambia solo cuando cambia el del sistema. La elección se guarda
 * en el dispositivo; no viaja al backend porque no es un dato financiero ni
 * hace falta en otro equipo.
 *
 * Cómo lo usan los componentes:
 *
 *   const useEstilos = crearEstilos((colores) => StyleSheet.create({ ... }));
 *   function Algo() {
 *     const estilos = useEstilos();      // estilos del tema activo
 *     const colores = useColores();      // para colores sueltos en el JSX
 *   }
 *
 * Los estilos se crean una vez por paleta y se reutilizan: cambiar de tema no
 * recrea hojas de estilo en cada render.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { paletaClara, paletaOscura, type Paleta } from "@/constants/tema";
import { guardar, leer } from "@/servicios/almacenamiento";

export type PreferenciaTema = "sistema" | "claro" | "oscuro";
export type Esquema = "claro" | "oscuro";

const CLAVE = "velvet.tema";

type ValorTema = {
  colores: Paleta;
  /** El tema que se está viendo, ya resuelto. */
  esquema: Esquema;
  /** Lo que eligió la persona. */
  preferencia: PreferenciaTema;
  cambiarPreferencia: (p: PreferenciaTema) => void;
};

// Fuera del proveedor (pruebas, pantallas sueltas) se ve el tema oscuro, que
// era el único que existía: nada que no sepa del tema cambia de aspecto.
const ContextoTema = createContext<ValorTema>({
  colores: paletaOscura,
  esquema: "oscuro",
  preferencia: "oscuro",
  cambiarPreferencia: () => {},
});

function esPreferencia(v: string | null): v is PreferenciaTema {
  return v === "sistema" || v === "claro" || v === "oscuro";
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const delSistema = useColorScheme();
  // Por defecto, el del sistema: quien tiene el teléfono en claro ve la app en claro.
  const [preferencia, setPreferencia] = useState<PreferenciaTema>("sistema");

  useEffect(() => {
    let vivo = true;
    leer(CLAVE).then((v) => {
      if (vivo && esPreferencia(v)) setPreferencia(v);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const cambiarPreferencia = useCallback((p: PreferenciaTema) => {
    setPreferencia(p);
    guardar(CLAVE, p).catch(() => {});
  }, []);

  const esquema: Esquema =
    preferencia === "sistema" ? (delSistema === "light" ? "claro" : "oscuro") : preferencia;

  const valor = useMemo<ValorTema>(
    () => ({
      colores: esquema === "claro" ? paletaClara : paletaOscura,
      esquema,
      preferencia,
      cambiarPreferencia,
    }),
    [esquema, preferencia, cambiarPreferencia],
  );

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema(): ValorTema {
  return useContext(ContextoTema);
}

/** La paleta del tema activo. */
export function useColores(): Paleta {
  return useContext(ContextoTema).colores;
}

/**
 * Hoja de estilos que depende del tema. Devuelve un hook: dentro del
 * componente, `const estilos = useEstilos()`.
 */
export function crearEstilos<T>(fabrica: (colores: Paleta) => T): () => T {
  const cache = new Map<Paleta, T>();
  return function useEstilos(): T {
    const colores = useContext(ContextoTema).colores;
    let estilos = cache.get(colores);
    if (estilos === undefined) {
      estilos = fabrica(colores);
      cache.set(colores, estilos);
    }
    return estilos;
  };
}
