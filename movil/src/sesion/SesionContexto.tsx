/**
 * Estado de sesión compartido por toda la aplicación.
 *
 * Cualquier pantalla pregunta `useSesion()` y obtiene el usuario conectado y
 * las operaciones de entrar y salir. Es el único lugar que conoce el token.
 *
 * `cargando` es true mientras se revisa el almacenamiento al arrancar: sin él,
 * la app mostraría el login por un instante antes de reconocer la sesión.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Credenciales, DatosRegistro, Usuario } from "@/modelo/tipos";
import * as auth from "@/servicios/auth";

type ValorSesion = {
  usuario: Usuario | null;
  cargando: boolean;
  entrar: (c: Credenciales) => Promise<void>;
  registrarse: (d: DatosRegistro) => Promise<void>;
  salir: () => Promise<void>;
};

const Contexto = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  // Al arrancar: ¿hay una sesión guardada de la vez anterior?
  useEffect(() => {
    auth
      .sesionGuardada()
      .then((s) => setUsuario(s?.usuario ?? null))
      .finally(() => setCargando(false));
  }, []);

  const entrar = useCallback(async (c: Credenciales) => {
    const sesion = await auth.iniciarSesion(c);
    setUsuario(sesion.usuario);
  }, []);

  const registrarse = useCallback(async (d: DatosRegistro) => {
    const sesion = await auth.registrar(d);
    setUsuario(sesion.usuario);
  }, []);

  const salir = useCallback(async () => {
    await auth.cerrarSesion();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, entrar, registrarse, salir }),
    [usuario, cargando, entrar, registrarse, salir],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useSesion se usó fuera de ProveedorSesion");
  return valor;
}
