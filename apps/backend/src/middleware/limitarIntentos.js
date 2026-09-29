const rateLimit = require("express-rate-limit");

// Frena la fuerza bruta: máximo 10 intentos FALLIDOS por IP cada 15 minutos.
// Los intentos correctos no cuentan. Cada llamada crea un limitador con su
// propio contador, así que login y activación no se afectan entre sí.
// Los contadores viven en memoria: se reinician si se reinicia el backend.
// Si se despliega detrás de un proxy, hay que configurar
// app.set("trust proxy", 1) en app.js; si no, todas las peticiones
// parecerían venir de la IP del proxy y se bloquearían entre sí.
const limitarFallidos = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos." },
  });

const limitarLogin = limitarFallidos(); // login del panel de administración
const limitarActivacion = limitarFallidos(); // activación de la app con PIN

// Pedir código de emparejamiento es público (la TV aún no tiene credenciales):
// se limita cada petición, no solo las fallidas, para que nadie llene la tabla.
const limitarCodigoTv = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de código. Inténtalo de nuevo en 15 minutos." },
});

module.exports = { limitarLogin, limitarActivacion, limitarCodigoTv };