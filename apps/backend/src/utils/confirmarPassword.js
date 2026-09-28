const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const httpError = (status, message) => Object.assign(new Error(message), { status });

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

// adminId -> { fallos, bloqueadoHasta }. En memoria: se reinicia con el backend.
const intentos = new Map();

// Vuelve a pedir la contraseña del administrador que hace la petición
// (body.passwordActual) antes de una acción sensible. Así una sesión
// abierta o un token robado no bastan por sí solos.
async function confirmarPassword(req) {
  const adminId = req.admin.id;
  const password = String(req.body.passwordActual || "");
  if (!password) throw httpError(400, "Confirma tu contraseña para continuar");

  // Todo lo de aquí hasta el primer await es síncrono: el intento se cuenta
  // ANTES de comparar, para que muchas peticiones en paralelo no se salten
  // el límite leyendo todas el mismo contador viejo.
  const ahora = Date.now();
  let estado = intentos.get(adminId);
  if (estado?.bloqueadoHasta && estado.bloqueadoHasta <= ahora) estado = undefined; // bloqueo vencido
  if (estado?.bloqueadoHasta) {
    const min = Math.ceil((estado.bloqueadoHasta - ahora) / 60_000);
    throw httpError(429, `Demasiados intentos fallidos. Inténtalo de nuevo en ${min} min.`);
  }
  const fallos = (estado?.fallos || 0) + 1;
  intentos.set(adminId, { fallos, bloqueadoHasta: fallos >= MAX_INTENTOS ? ahora + BLOQUEO_MS : 0 });

  const [rows] = await pool.query("SELECT password_hash FROM admins WHERE id = ?", [adminId]);
  const correcta = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
  // 403 y no 401: el panel cierra la sesión con cualquier 401.
  if (!correcta) throw httpError(403, "Tu contraseña es incorrecta");

  intentos.delete(adminId);
}

module.exports = { confirmarPassword };