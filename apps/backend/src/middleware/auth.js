const pool = require("../config/db");
const { verificarTokenDispositivo } = require("../utils/tokens");

// No basta con validar la firma del JWT: hay que checar en BD que el
// dispositivo siga activo, porque la revocación del admin debe surtir
// efecto de inmediato (no hasta que expire un token que no expira solo).
async function requireDeviceSession(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Falta token de sesión" });

  let payload;
  try {
    payload = verificarTokenDispositivo(token);
  } catch {
    return res.status(401).json({ error: "Token de sesión inválido" });
  }

  const [rows] = await pool.query(
    "SELECT id, empleado_id, activo FROM dispositivos_empleado WHERE id = ? LIMIT 1",
    [payload.dispositivoId]
  );
  const dispositivo = rows[0];
  if (!dispositivo || !dispositivo.activo) {
    return res.status(401).json({ error: "Sesión revocada. Contacta a RH para reactivar tu dispositivo." });
  }

  req.empleadoId = dispositivo.empleado_id;
  req.dispositivoId = dispositivo.id;
  next();
}

module.exports = { requireDeviceSession };
