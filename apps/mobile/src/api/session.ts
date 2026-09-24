import * as SecureStore from "expo-secure-store";

const KEY = "checador_device_token";
const DEVICE_ID_KEY = "checador_device_id";

export async function guardarToken(token: string) {
  await SecureStore.setItemAsync(KEY, token);
}

export async function obtenerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function borrarToken() {
  await SecureStore.deleteItemAsync(KEY);
}

// Identificador estable de esta instalación de la app. Se genera una
// sola vez y se reutiliza en cada activación/reactivación.
export async function obtenerOCrearDeviceId(): Promise<string> {
  const existente = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existente) return existente;

  const nuevo = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, nuevo);
  return nuevo;
}
