/**
 * Servicio de autenticación.
 *
 * Hoy simula al backend; cuando existan los endpoints, se reemplaza el cuerpo
 * de `registrar` e `iniciarSesion` por peticiones HTTP y no se toca ninguna
 * pantalla. Los endpoints acordados:
 *
 *   POST /api/auth/registro  { nombre, email, password }  -> SesionIniciada
 *   POST /api/auth/sesion    { email, password }          -> SesionIniciada
 *
 * Reglas que se mantienen igual con backend real:
 *  · La contraseña se envía una vez y no se guarda nunca en el dispositivo.
 *  · Lo que se guarda es el token, en el almacén seguro del sistema.
 *  · El error de credenciales no dice si falló el correo o la contraseña:
 *    distinguirlos permite averiguar qué correos están registrados.
 */
import type { Credenciales, DatosRegistro, SesionIniciada, Usuario } from "@/modelo/tipos";
import { borrar, guardar, leer } from "@/servicios/almacenamiento";

const CLAVE_SESION = "velvet.sesion";

/** Error con mensaje pensado para mostrarse tal cual al usuario. */
export class ErrorAuth extends Error {}

// ───────────────────── simulación del backend ─────────────────────
// Cuenta de demostración, para poder mostrar el inicio de sesión sin
// registrarse antes. Desaparece cuando exista el backend.
type CuentaDemo = Usuario & { password: string };

const CUENTAS: CuentaDemo[] = [
  {
    id: "usr-demo",
    nombre: "Jossue Padrón",
    email: "demo@velvetwallet.cl",
    password: "velvet2026",
    sueldoDeclarado: 850_000,
    creadoEn: "2026-09-01T10:00:00.000Z",
  },
];

/** Simula la latencia de red para que la interfaz se comporte como con backend. */
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sesionPara(usuario: Usuario): SesionIniciada {
  const expira = new Date();
  expira.setDate(expira.getDate() + 30);
  return {
    token: `demo.${usuario.id}.${Date.now()}`,
    expiraEn: expira.toISOString(),
    usuario,
  };
}

// ───────────────────────── validaciones ─────────────────────────
// Las mismas reglas las tiene que aplicar el backend: validar solo en el
// cliente no sirve, porque se puede llamar a la API directamente.

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Mínimo 8 caracteres. Devuelve null si está bien, o el motivo. */
export function problemaPassword(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}

// ───────────────────────── operaciones ─────────────────────────

export async function registrar(datos: DatosRegistro): Promise<SesionIniciada> {
  await esperar(600);

  const email = datos.email.trim().toLowerCase();
  if (CUENTAS.some((c) => c.email === email)) {
    throw new ErrorAuth("Ya existe una cuenta con este correo.");
  }

  const usuario: Usuario = {
    id: `usr-${Date.now()}`,
    nombre: datos.nombre.trim(),
    email,
    sueldoDeclarado: null,
    creadoEn: new Date().toISOString(),
  };
  CUENTAS.push({ ...usuario, password: datos.password });

  const sesion = sesionPara(usuario);
  await guardarSesion(sesion);
  return sesion;
}

export async function iniciarSesion({ email, password }: Credenciales): Promise<SesionIniciada> {
  await esperar(600);

  const cuenta = CUENTAS.find((c) => c.email === email.trim().toLowerCase());
  // Mensaje único a propósito: no revelar si el correo existe.
  if (!cuenta || cuenta.password !== password) {
    throw new ErrorAuth("Correo o contraseña incorrectos.");
  }

  const { password: _, ...usuario } = cuenta;
  const sesion = sesionPara(usuario);
  await guardarSesion(sesion);
  return sesion;
}

export async function cerrarSesion(): Promise<void> {
  await borrar(CLAVE_SESION);
}

// ───────────────────── persistencia de la sesión ─────────────────────

async function guardarSesion(sesion: SesionIniciada): Promise<void> {
  await guardar(CLAVE_SESION, JSON.stringify(sesion));
}

/** Sesión guardada, si existe y no expiró. Se llama al arrancar la app. */
export async function sesionGuardada(): Promise<SesionIniciada | null> {
  const bruto = await leer(CLAVE_SESION);
  if (!bruto) return null;

  try {
    const sesion = JSON.parse(bruto) as SesionIniciada;
    if (new Date(sesion.expiraEn) <= new Date()) {
      await borrar(CLAVE_SESION);
      return null;
    }
    return sesion;
  } catch {
    // Dato corrupto: se descarta y se empieza de nuevo.
    await borrar(CLAVE_SESION);
    return null;
  }
}
