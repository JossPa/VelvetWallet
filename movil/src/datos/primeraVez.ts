/**
 * Marcas de "esto ya se mostró una vez".
 *
 * Van en el almacenamiento del dispositivo y no en el backend: son una
 * preferencia de presentación, no un dato del titular. Guardarlas en el
 * servidor significaría registrar en la base qué pantallas vio una persona,
 * que es exactamente el tipo de dato que este proyecto evita acumular sin
 * necesidad.
 *
 * La clave incluye el id del usuario para que, si dos personas usan el mismo
 * teléfono, cada una vea el aviso la primera vez. Si falla la lectura se
 * asume que no se ha visto: repetir un aviso molesta, pero ocultarlo a quien
 * nunca lo vio es peor cuando el aviso explica qué se hace con sus datos.
 */
import { guardar, leer } from "@/servicios/almacenamiento";

export type Aviso = "clasificacion";

const clave = (aviso: Aviso, usuarioId: string) => `velvet.visto.${aviso}.${usuarioId}`;

export async function yaSeVio(aviso: Aviso, usuarioId: string): Promise<boolean> {
  try {
    return (await leer(clave(aviso, usuarioId))) === "1";
  } catch {
    return false;
  }
}

export async function marcarVisto(aviso: Aviso, usuarioId: string): Promise<void> {
  try {
    await guardar(clave(aviso, usuarioId), "1");
  } catch {
    // Si no se pudo guardar, el aviso volverá a salir. Es el fallo correcto.
  }
}
