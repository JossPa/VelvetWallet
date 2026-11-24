/**
 * Dónde está el backend. Un solo lugar para toda la app.
 *
 * El backend corre en el mismo computador que sirve la app, en el puerto
 * 8000. La dirección se decide así, en orden:
 *
 *   1. La que el usuario escribió en la app ("Servidor" en el inicio de
 *      sesión). Se guarda en el teléfono y sobrevive a cerrar la app: sirve
 *      cuando cambia la IP del PC y no se quiere recompilar la APK.
 *   2. EXPO_PUBLIC_API_URL, fijada al compilar (la APK la trae así).
 *   3. Deducida de cómo se abrió la app:
 *        · Web abierta en el PC como localhost:8081   → http://localhost:8000
 *        · Web abierta en el celular como IP:8081      → http://IP:8000
 *        · Expo Go en el celular (exp://IP:8081)       → http://IP:8000
 *
 * Se lee con api(), no con una constante, porque puede cambiar en marcha.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

import * as almacen from "@/servicios/almacenamiento";

const PUERTO_BACKEND = 8000;
const CLAVE = "velvet.servidor";

function limpiar(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function porDefecto(): string {
  const fija = process.env.EXPO_PUBLIC_API_URL;
  if (fija) return limpiar(fija);

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${PUERTO_BACKEND}`;
  }

  // En el celular, Expo informa desde qué computador se cargó la app ("IP:8081").
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host || "localhost"}:${PUERTO_BACKEND}`;
}

export const SERVIDOR_POR_DEFECTO = porDefecto();
let actual = SERVIDOR_POR_DEFECTO;

/** La dirección del backend, sin "/" al final. */
export function api(): string {
  return actual;
}

/** Lee la dirección guardada en el teléfono, si hay. Se llama al arrancar. */
export async function cargarServidor(): Promise<void> {
  try {
    const guardado = await almacen.leer(CLAVE);
    if (guardado) actual = limpiar(guardado);
  } catch {
    // Sin almacenamiento disponible: se queda la de por defecto.
  }
}

/**
 * Normaliza lo que escribe el usuario: "192.168.1.5" → "http://192.168.1.5:8000".
 * Devuelve null si no parece una dirección.
 */
export function normalizarServidor(texto: string): string | null {
  let t = texto.trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) t = `http://${t}`;
  try {
    const u = new URL(t);
    if (!u.hostname) return null;
    const puerto = u.port || (u.protocol === "https:" ? "" : String(PUERTO_BACKEND));
    return limpiar(`${u.protocol}//${u.hostname}${puerto ? `:${puerto}` : ""}${u.pathname}`);
  } catch {
    return null;
  }
}

/** Cambia la dirección y la recuerda. Con null vuelve a la de por defecto. */
export async function fijarServidor(url: string | null): Promise<void> {
  if (url) {
    actual = limpiar(url);
    await almacen.guardar(CLAVE, actual);
  } else {
    actual = SERVIDOR_POR_DEFECTO;
    await almacen.borrar(CLAVE);
  }
}

/** ¿Responde el backend en esa dirección? */
export async function probarServidor(url: string): Promise<boolean> {
  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), 5000);
  try {
    const r = await fetch(`${limpiar(url)}/health`, { signal: control.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(plazo);
  }
}
