/**
 * Guardado del token de sesión — versión para el navegador.
 *
 * El navegador no tiene almacén cifrado del sistema, así que se usa
 * localStorage. Sirve para desarrollar; NO es equivalente en seguridad a la
 * versión del teléfono, y así hay que declararlo: la aplicación objetivo es
 * móvil, la web es solo entorno de desarrollo.
 */
export async function guardar(clave: string, valor: string): Promise<void> {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Modo privado o almacenamiento bloqueado: la sesión dura lo que la pestaña.
  }
}

export async function leer(clave: string): Promise<string | null> {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export async function borrar(clave: string): Promise<void> {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Nada que hacer: si no se pudo escribir, tampoco hay qué borrar.
  }
}
