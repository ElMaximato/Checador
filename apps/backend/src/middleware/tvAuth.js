const pool = require("../config/db");
const { verificarTokenTv } = require("../utils/tokens");

// Sesión de una pantalla de TV: JWT propio (JWT_TV_SECRET) + revisión en BD
// de que siga emparejada, para que revocarla surta efecto de inmediato.
async function requireTv(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Falta token de TV" });

  let payload;
  try {
    payload = verificarTokenTv(token);
  } catch {
    return res.status(401).json({ error: "Token de TV inválido" });
  }

  const [rows] = await pool.query(
    "SELECT id, nombre, estado, activo, playlist_activa_id FROM dispositivos_tv WHERE id = ? LIMIT 1",
    [payload.dispositivoId]
  );
  const tv = rows[0];
  if (!tv || tv.estado !== "emparejado" || !tv.activo) {
    return res.status(401).json({ error: "Esta pantalla ya no está autorizada" });
  }

  req.tv = tv;
  next();
}

module.exports = { requireTv };
