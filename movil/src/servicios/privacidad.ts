/**
 * Consentimiento por finalidad de tratamiento.
 *
 * Separado de la vinculación del banco a propósito: autorizar que Velvet LEA
 * tus datos no autoriza a USARLOS para otra cosa. Cada finalidad se consiente,
 * vence y se revoca por su cuenta.
 */
import { leer } from "@/servicios/almacenamiento";

const API = "http://localhost:8000";
const CLAVE_SESION = "velvet.sesion";

export type Finalidad = {
  id: string;
  titulo: string;
  resumen: string;
  detalle: string[];
  vigenciaDias: number;
  consentido: boolean;
  desde: string | null;
  vence: string | null;
  /** El texto cambió desde que lo aceptó: hay que volver a preguntarle. */
  textoDesactualizado: boolean;
};

export class ErrorPrivacidad extends Error {}

async function token(): Promise<string> {
  const bruto = await leer(CLAVE_SESION);
  if (!bruto) throw new ErrorPrivacidad("No hay sesión.");
  return (JSON.parse(bruto) as { token: string }).token;
}

async function pedir(ruta: string, cuerpo?: unknown): Promise<any> {
  let r: Response;
  try {
    r = await fetch(`${API}/api/privacidad${ruta}`, {
      method: cuerpo ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await token()}`,
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorPrivacidad("No se pudo conectar con el servidor.");
  }
  if (!r.ok) throw new ErrorPrivacidad(`El servidor respondió ${r.status}.`);
  return r.json();
}

export async function obtenerFinalidades(): Promise<Finalidad[]> {
  const cuerpo = await pedir("/finalidades");
  return cuerpo.finalidades.map((f: any) => ({
    id: f.id,
    titulo: f.titulo,
    resumen: f.resumen,
    detalle: f.detalle,
    vigenciaDias: f.vigencia_dias,
    consentido: f.consentido,
    desde: f.desde,
    vence: f.vence,
    textoDesactualizado: f.textoDesactualizado,
  }));
}

/** Otorga o revoca. Revocar no borra el registro de que hubo consentimiento. */
export async function decidirFinalidad(id: string, acepta: boolean): Promise<void> {
  await pedir(`/finalidades/${id}`, { acepta });
}
