/**
 * Asistente conversacional.
 *
 *   POST /api/asistente  { mensajes: [{ rol, texto }] }  ->  { respuesta, consultas }
 *
 * La conversación la guarda la app, no el servidor: se manda completa en cada
 * pregunta y se pierde al cerrar la pantalla. Una conversación sobre plata es
 * un dato personal más, y lo más simple para protegerlo es no almacenarlo.
 */
import { tokenActual } from "@/servicios/auth";

const API = "http://localhost:8000";

export type Mensaje = {
  rol: "usuario" | "asistente";
  texto: string;
  /** Qué consultó el asistente para responder: la prueba de que no inventó. */
  consultas?: string[];
};

/** Por qué no respondió. Cada caso se muestra distinto en la pantalla. */
export type MotivoError = "sin_consentimiento" | "no_configurado" | "no_disponible" | "conexion" | "sesion";

export class ErrorAsistente extends Error {
  constructor(public motivo: MotivoError, mensaje: string) {
    super(mensaje);
  }
}

export async function preguntar(historial: Mensaje[]): Promise<Mensaje> {
  const token = await tokenActual();
  if (!token) throw new ErrorAsistente("sesion", "Tu sesión expiró. Vuelve a entrar.");

  let r: Response;
  try {
    r = await fetch(`${API}/api/asistente`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mensajes: historial.map(({ rol, texto }) => ({ rol, texto })) }),
    });
  } catch {
    throw new ErrorAsistente("conexion", "No se pudo conectar con el servidor.");
  }

  const datos = await r.json().catch(() => null);
  if (!r.ok) {
    const detalle = datos?.detail;
    const codigo = (detalle?.codigo as MotivoError | undefined) ?? "no_disponible";
    const mensaje = typeof detalle === "string" ? detalle : detalle?.mensaje ?? "No pude responder ahora.";
    throw new ErrorAsistente(r.status === 401 ? "sesion" : codigo, mensaje);
  }
  return { rol: "asistente", texto: datos.respuesta, consultas: datos.consultas ?? [] };
}
