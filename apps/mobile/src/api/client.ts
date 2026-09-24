import { borrarToken, obtenerToken } from "./session";
import { API_BASE_URL } from "./config";

export { API_BASE_URL };

// Tiempos límite: sin ellos, si el servidor no responde la app se queda
// cargando para siempre.
const TIMEOUT_MS = 12_000;
const TIMEOUT_FOTO_MS = 30_000;
const MSG_SIN_CONEXION = "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";

export class ApiError extends Error {
  status: number; // 0 = sin conexión / tiempo agotado
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// --- Sesión revocada ---
// Si el backend responde 401 a una petición con sesión (token inválido o
// dispositivo revocado por RH / desvinculado), se borra el token local y
// se avisa a App.tsx para que mande al empleado a Activación.
let manejadorSesionInvalida: (() => void) | null = null;
let ultimoAviso = 0;

export function registrarManejadorSesionInvalida(fn: (() => void) | null) {
  manejadorSesionInvalida = fn;
}

async function notificarSesionInvalida() {
  await borrarToken();
  // Home lanza varias peticiones a la vez: avisar solo una vez.
  if (Date.now() - ultimoAviso < 3000) return;
  ultimoAviso = Date.now();
  manejadorSesionInvalida?.();
}

// --- Núcleo de peticiones ---

async function manejarRespuesta(res: Response, conSesion: boolean) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && conSesion) await notificarSesionInvalida();
    throw new ApiError(data.error || "Ocurrió un error inesperado", res.status);
  }
  return data;
}

async function peticion(
  ruta: string,
  init: RequestInit = {},
  opciones: { conSesion?: boolean; timeoutMs?: number } = {}
) {
  const { conSesion = true, timeoutMs = TIMEOUT_MS } = opciones;

  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (conSesion) {
    const token = await obtenerToken();
    if (!token) throw new ApiError("No hay sesión activa. Vuelve a activar la app.", 401);
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${ruta}`, { ...init, headers, signal: controller.signal });
    return await manejarRespuesta(res, conSesion);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(MSG_SIN_CONEXION, 0); // sin red, servidor caído o tiempo agotado
  } finally {
    clearTimeout(timer);
  }
}

// --- Auth (Capa 1: PIN + activación de dispositivo) ---

export async function activarDispositivo(params: {
  codigo: string; // ID de empleado, ej. NX-1001
  pin: string;
  deviceId: string;
  deviceInfo?: string;
}): Promise<{ token: string }> {
  return peticion(
    "/api/auth/activar",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    { conSesion: false }
  );
}

// Revoca este teléfono en el servidor. Requiere conexión.
export async function desvincularDispositivo(): Promise<void> {
  await peticion("/api/auth/desvincular", { method: "POST" });
}

// --- Attendance ---

export type JornadaHoy = {
  estado: "activa" | "cerrada" | "expirada_sin_salida";
  puntualidad: "a_tiempo" | "tarde";
  horaEntrada: string;
  horaSalida: string | null;
  // Minutos trabajados hoy al momento de la consulta (null si expiró sin salida).
  minutosTrabajados: number | null;
} | null;

export async function obtenerJornadaHoy(): Promise<JornadaHoy> {
  const data = await peticion("/api/attendance/hoy");
  return data.jornada;
}

async function enviarAsistencia(tipo: "entrada" | "salida", fotoUri: string) {
  const form = new FormData();
  form.append("foto", {
    uri: fotoUri,
    name: "asistencia.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  return peticion(
    `/api/attendance/${tipo}`,
    { method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: form },
    { timeoutMs: TIMEOUT_FOTO_MS }
  );
}

export function registrarEntrada(fotoUri: string) {
  return enviarAsistencia("entrada", fotoUri);
}

export function registrarSalida(fotoUri: string) {
  return enviarAsistencia("salida", fotoUri);
}

// --- Perfil del empleado ---

export type Perfil = {
  id: number;
  codigo: string; // ej. NX-1001
  nombre: string;
  puesto: string;
  departamento: string;
  estado: "activo" | "inactivo" | "baja";
  horario: { nombre: string; horaEntrada: string; horaSalida: string };
};

export async function obtenerPerfil(): Promise<Perfil> {
  return peticion("/api/me");
}

// --- Historial ---

export type RegistroHistorial = {
  fecha: string;
  dia: string;
  diaSemana: string;
  horaEntrada: string;
  horaSalida: string | null;
  minutosTotales: number | null;
  puntualidad: "a_tiempo" | "tarde";
  estado: "activa" | "cerrada" | "expirada_sin_salida";
};

export type Historial = {
  mes: string; // YYYY-MM
  resumen: {
    diasLaborados: number;
    minutosTotales: number;
    puntualidadPct: number | null;
    asistenciaPct: number | null;
    diasEsperados: number;
  };
  registros: RegistroHistorial[];
};

export async function obtenerHistorial(mes: string): Promise<Historial> {
  return peticion(`/api/attendance/historial?mes=${mes}`);
}
