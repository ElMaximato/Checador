import { obtenerToken } from "./session";

// En desarrollo con dispositivo físico, "localhost" apunta al propio
// teléfono, no a tu computadora: reemplázalo por la IP local de tu
// máquina en la red (ej. "http://192.168.1.50:4000"). En simulador/
// emulador sí funciona localhost (Android emulator usa 10.0.2.2).
export const API_BASE_URL = "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function manejarRespuesta(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || "Ocurrió un error inesperado", res.status);
  }
  return data;
}

// --- Auth (Capa 1: PIN + activación de dispositivo) ---

export async function activarDispositivo(params: {
  empleadoId: string;
  pin: string;
  deviceId: string;
  deviceInfo?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/auth/activar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return manejarRespuesta(res) as Promise<{ token: string }>;
}

// --- Attendance ---

export type JornadaHoy = {
  estado: "activa" | "cerrada" | "expirada_sin_salida";
  puntualidad: "a_tiempo" | "tarde";
  horaEntrada: string;
  horaSalida: string | null;
} | null;

async function authHeaders() {
  const token = await obtenerToken();
  if (!token) throw new ApiError("No hay sesión activa. Vuelve a activar la app.", 401);
  return { Authorization: `Bearer ${token}` };
}

export async function obtenerJornadaHoy(): Promise<JornadaHoy> {
  const res = await fetch(`${API_BASE_URL}/api/attendance/hoy`, {
    headers: await authHeaders(),
  });
  const data = await manejarRespuesta(res);
  return data.jornada;
}

async function enviarAsistencia(tipo: "entrada" | "salida", fotoUri: string) {
  const form = new FormData();
  form.append("foto", {
    uri: fotoUri,
    name: "asistencia.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  const res = await fetch(`${API_BASE_URL}/api/attendance/${tipo}`, {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "multipart/form-data",
    },
    body: form,
  });
  return manejarRespuesta(res);
}

export function registrarEntrada(fotoUri: string) {
  return enviarAsistencia("entrada", fotoUri) as ReturnType<typeof enviarAsistencia>;
}

export function registrarSalida(fotoUri: string) {
  return enviarAsistencia("salida", fotoUri);
}
