/**
 * Sincronización: trae los movimientos del usuario desde el backend.
 *
 * Las capas acordadas son:
 *
 *     app  →  backend  →  ingesta  →  cliente SFA  →  EFS / banco
 *
 * La app ya NO habla con la institución directamente ni normaliza en el
 * dispositivo: pide sus movimientos al backend, que los entrega ya en el modelo
 * canónico (clasificados, deduplicados) y SOLO los del usuario del token. Así
 * cada usuario ve únicamente lo suyo.
 */
import type { Movimiento } from "@/modelo/tipos";
import { tokenActual } from "@/servicios/auth";

/**
 * URL del backend. En web, localhost funciona. En un celular físico, cámbiala
 * por la IP de tu PC en la red (ej: "http://192.168.1.20:8000").
 */
const API = "http://localhost:8000";

export class ErrorSincronizacion extends Error {}

/**
 * Trae los movimientos del usuario autenticado. Manda el token de sesión; el
 * backend responde solo con los datos de ese usuario (WHERE usuario_id = …).
 */
export async function obtenerMovimientos(): Promise<Movimiento[]> {
  const token = await tokenActual();
  if (!token) {
    throw new ErrorSincronizacion("Tu sesión no está activa. Inicia sesión de nuevo.");
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API}/api/movimientos?limite=500`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ErrorSincronizacion(
      "No se pudo conectar con el servidor. Revisa que el backend esté corriendo.",
    );
  }

  if (!respuesta.ok) {
    throw new ErrorSincronizacion(`El servidor respondió ${respuesta.status}.`);
  }

  const cuerpo = (await respuesta.json()) as { movimientos: Movimiento[] };
  return cuerpo.movimientos;
}

export type ResultadoConexion = {
  institucion: string;
  cuentas: number;
  movimientosNuevos: number;
  movimientosActualizados: number;
};

/**
 * Vincula un banco al usuario: ES la "petición de permiso" del SFA. El usuario
 * la pide explícitamente; recién entonces el backend obtiene el consentimiento,
 * el token, y trae sus datos. Puede tardar unos segundos (baja el historial).
 */
export async function conectarBanco(): Promise<ResultadoConexion> {
  const token = await tokenActual();
  if (!token) {
    throw new ErrorSincronizacion("Tu sesión no está activa. Inicia sesión de nuevo.");
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API}/api/conexiones`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    throw new ErrorSincronizacion(
      "No se pudo conectar con el servidor. Revisa que el backend esté corriendo.",
    );
  }

  if (!respuesta.ok) {
    throw new ErrorSincronizacion("No se pudo vincular el banco. Intenta de nuevo.");
  }
  return (await respuesta.json()) as ResultadoConexion;
}
