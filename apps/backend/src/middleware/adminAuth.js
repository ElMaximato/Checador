const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Sesión del panel web: JWT propio (JWT_ADMIN_SECRET) y se revisa en BD que
// el administrador siga activo.
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Falta token de administrador" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
  } catch {
    return res.status(401).json({ error: "Sesión expirada. Inicia sesión de nuevo." });
  }

  const [rows] = await pool.query("SELECT id, nombre, rol, activo FROM admins WHERE id = ? LIMIT 1", [payload.adminId]);
  if (!rows[0] || !rows[0].activo) return res.status(401).json({ error: "Administrador inactivo" });

  req.admin = rows[0];
  next();
}

module.exports = { requireAdmin };
