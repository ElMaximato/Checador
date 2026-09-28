const cors = require("cors");

// Orígenes de navegador autorizados a llamar al API y a Socket.IO.
// Se configuran con CORS_ORIGINS (separados por coma, sin barra final):
//   CORS_ORIGINS=https://panel.miempresa.com,https://tv.miempresa.com
// - Sin la variable y fuera de producción: solo el panel en modo desarrollo.
// - Sin la variable y en producción: ningún navegador queda autorizado.
// La app móvil no depende de esto (no envía cabecera Origin).
const ORIGENES_DEV = ["http://localhost:5173", "http://127.0.0.1:5173"];

function leerOrigenes() {
  const lista = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, "").toLowerCase())
    .filter(Boolean);

  if (lista.includes("*")) {
    throw new Error('CORS_ORIGINS no acepta "*": enumera los orígenes permitidos, ej. https://panel.miempresa.com');
  }
  if (lista.length) return lista;
  if (process.env.NODE_ENV === "production") {
    console.warn("CORS_ORIGINS está vacío en producción: ningún navegador podrá usar el API.");
    return [];
  }
  return ORIGENES_DEV;
}

const ORIGENES = leerOrigenes();

// Sin cabecera Origin = no es un navegador (app móvil, curl, /health del servidor): se deja pasar.
const origenPermitido = (origin) => !origin || ORIGENES.includes(origin.toLowerCase());

const opcionesCors = { origin: (origin, cb) => cb(null, origenPermitido(origin)) };

// Corta con 403 (y deja rastro en consola) cualquier navegador desde un origen no autorizado,
// incluido el preflight, en vez de dejar que la petición se ejecute y solo el navegador la oculte.
function bloquearOrigenNoPermitido(req, res, next) {
  const origin = req.headers.origin;
  if (origenPermitido(origin)) return next();
  console.warn(`CORS: origen no permitido ${origin} (${req.method} ${req.originalUrl})`);
  res.status(403).json({ error: "Origen no permitido" });
}

module.exports = {
  ORIGENES,
  corsHttp: cors(opcionesCors),
  bloquearOrigenNoPermitido,
  // Opciones para `new Server(server, ...)` de Socket.IO
  opcionesSocket: {
    cors: opcionesCors,
    // Además de las cabeceras, rechaza el handshake desde orígenes no autorizados.
    allowRequest: (req, cb) =>
      origenPermitido(req.headers.origin) ? cb(null, true) : cb("Origen no permitido", false),
  },
};