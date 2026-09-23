export type Screen =
  | "login"
  | "home"
  | "fingerprint"
  | "camera"
  | "confirmation"
  | "history"
  | "profile";

// Datos que necesita la pantalla de confirmación tras un check-in real.
// Hoy se llenan con datos simulados; cuando se conecte el backend,
// go("confirmation", { ...respuestaDelApi }) reemplaza al mock.
export type AttendanceResult = {
  tipo: "entrada" | "salida";
  hora: string;
  puntualidad: "a_tiempo" | "tarde";
  jornadaTotal?: string;
};
