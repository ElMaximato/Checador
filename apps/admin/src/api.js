// URL del backend. Para otro servidor: crea un .env con VITE_API_URL=https://...
const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const foto = (ruta) => (ruta ? BASE + ruta : null);
export const getToken = () => localStorage.getItem("admin_token");

let alCerrarSesion = () => {};
export const setAlCerrarSesion = (fn) => (alCerrarSesion = fn);

export async function api(ruta, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api/admin${ruta}`, {
      method,
      headers: { "Content-Type": "application/json", ...(getToken() && { Authorization: `Bearer ${getToken()}` }) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && ruta !== "/login") {
    localStorage.removeItem("admin_token");
    alCerrarSesion();
  }
  if (!res.ok) throw new Error(data.error || "Error inesperado");
  return data;
}
