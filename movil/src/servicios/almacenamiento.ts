/**
 * Guardado seguro del token de sesión — versión para el teléfono.
 *
 * Usa el almacén cifrado del sistema operativo: Keychain en iOS y el
 * almacenamiento respaldado por Keystore en Android. Otras aplicaciones no
 * pueden leerlo, y se borra al desinstalar.
 *
 * Existe un almacenamiento.web.ts para el navegador: el empaquetador elige
 * el archivo según dónde corra la aplicación.
 */
import * as SecureStore from "expo-secure-store";

export async function guardar(clave: string, valor: string): Promise<void> {
  await SecureStore.setItemAsync(clave, valor);
}

export async function leer(clave: string): Promise<string | null> {
  return SecureStore.getItemAsync(clave);
}

export async function borrar(clave: string): Promise<void> {
  await SecureStore.deleteItemAsync(clave);
}
