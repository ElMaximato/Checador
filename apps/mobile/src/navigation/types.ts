export type Screen =
  | "loading"
  | "activation"
  | "login"
  | "home"
  | "fingerprint"
  | "camera"
  | "confirmation"
  | "history"
  | "profile";

export type AttendanceResult = {
  tipo: "entrada" | "salida";
  hora: string;
  puntualidad: "a_tiempo" | "tarde";
  jornadaTotal?: string;
};

// Datos que viajan entre pantallas del flujo de check-in.
// `tipo` se decide en Home (según la jornada de hoy) y viaja hasta
// Camera, que es quien realmente llama al backend.
export type NavParams = {
  tipo?: "entrada" | "salida";
  result?: AttendanceResult;
};

export type GoFn = (screen: Screen, params?: NavParams) => void;
