const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { confirmarPassword } = require("../utils/confirmarPassword");

const httpError = (status, message) => Object.assign(new Error(message), { status });

const ROLES = ["super_admin", "rh", "supervisor"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_MAX = 80;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt ignora todo lo que pase de 72 bytes

function leerDatos(b, { passwordObligatoria }) {
  const nombre = String(b.nombre || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");

  if (!nombre) throw httpError(400, "El nombre es requerido");
  if (nombre.length > NOMBRE_MAX) throw httpError(400, `El nombre no puede exceder ${NOMBRE_MAX} caracteres`);
  if (!EMAIL_RE.test(email) || email.length > 150) throw httpError(400, "Correo inválido");
  if (!ROLES.includes(b.rol)) throw httpError(400, "Rol inválido");
  if (passwordObligatoria || password) {
    if (password.length < PASSWORD_MIN) throw httpError(400, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`);
    if (password.length > PASSWORD_MAX) throw httpError(400, `La contraseña no puede exceder ${PASSWORD_MAX} caracteres`);
  }
  return { nombre, email, rol: b.rol, password };
}

function traducirDuplicado(err) {
  return err.code === "ER_DUP_ENTRY" ? httpError(409, "Ya existe un administrador con ese correo") : err;
}

async function listarAdministradores(req, res) {
  const [rows] = await pool.query("SELECT id, nombre, email, rol, activo, created_at FROM admins ORDER BY id");
  res.json(
    rows.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      email: a.email,
      rol: a.rol,
      activo: !!a.activo,
      creado: a.created_at,
      esYo: a.id === req.admin.id,
    }))
  );
}

async function crearAdministrador(req, res) {
  await confirmarPassword(req);
  const d = leerDatos(req.body, { passwordObligatoria: true });
  const hash = await bcrypt.hash(d.password, 10);
  try {
    const [r] = await pool.query("INSERT INTO admins (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)", [
      d.nombre,
      d.email,
      hash,
      d.rol,
    ]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    throw traducirDuplicado(err);
  }
}

async function editarAdministrador(req, res) {
  await confirmarPassword(req);
  const id = Number(req.params.id);
  const d = leerDatos(req.body, { passwordObligatoria: false });

  // Como nadie puede quitarse a sí mismo el rol ni desactivarse, y solo un
  // super_admin llega hasta aquí, siempre queda al menos un super_admin activo.
  if (id === req.admin.id && d.rol !== req.admin.rol) throw httpError(400, "No puedes cambiar tu propio rol");

  let sql = "UPDATE admins SET nombre = ?, email = ?, rol = ?";
  const params = [d.nombre, d.email, d.rol];
  if (d.password) {
    sql += ", password_hash = ?";
    params.push(await bcrypt.hash(d.password, 10));
  }
  sql += " WHERE id = ?";
  params.push(id);

  try {
    const [r] = await pool.query(sql, params);
    if (!r.affectedRows) throw httpError(404, "Administrador no encontrado");
    res.json({ ok: true });
  } catch (err) {
    throw traducirDuplicado(err);
  }
}

async function cambiarEstadoAdministrador(req, res) {
  await confirmarPassword(req);
  const id = Number(req.params.id);
  const { activo } = req.body;
  if (typeof activo !== "boolean") throw httpError(400, "Estado inválido");
  if (id === req.admin.id) throw httpError(400, "No puedes desactivar tu propia cuenta");

  const [r] = await pool.query("UPDATE admins SET activo = ? WHERE id = ?", [activo, id]);
  if (!r.affectedRows) throw httpError(404, "Administrador no encontrado");
  res.json({ ok: true });
}

module.exports = { listarAdministradores, crearAdministrador, editarAdministrador, cambiarEstadoAdministrador };