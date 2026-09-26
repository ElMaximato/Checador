const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { codigoDesdeId } = require("../utils/codigoEmpleado");
const { generarPin } = require("./auth.controller");

const httpError = (status, message) => Object.assign(new Error(message), { status });

function fechaISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const hhmmDT = (v) => (v ? String(v).slice(11, 16) : null); // DATETIME -> HH:MM
const hhmmT = (v) => String(v).slice(0, 5); // TIME -> HH:MM

// ---------- Login ----------
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, "Ingresa correo y contraseña");
  const [rows] = await pool.query("SELECT * FROM admins WHERE email = ? AND activo = TRUE LIMIT 1", [email]);
  const a = rows[0];
  if (!a || !(await bcrypt.compare(password, a.password_hash))) throw httpError(401, "Correo o contraseña incorrectos");
  const token = jwt.sign({ adminId: a.id }, process.env.JWT_ADMIN_SECRET, { expiresIn: "8h" });
  res.json({ token, admin: { nombre: a.nombre, rol: a.rol } });
}

// ---------- Empleados ----------
async function departamentoId(nombre) {
  const n = String(nombre || "").trim();
  if (!n) throw httpError(400, "El departamento es requerido");
  await pool.query("INSERT IGNORE INTO departamentos (nombre) VALUES (?)", [n]);
  const [r] = await pool.query("SELECT id FROM departamentos WHERE nombre = ?", [n]);
  return r[0].id;
}

// Listas para los combos del formulario de empleados: departamentos ya
// dados de alta y puestos que ya se han usado (así no se escriben a mano
// variantes del mismo puesto, ej. "Dev" / "Desarrollador").
async function listarOpciones(req, res) {
  const [dep] = await pool.query("SELECT nombre FROM departamentos ORDER BY nombre");
  const [pue] = await pool.query("SELECT DISTINCT puesto FROM empleados WHERE puesto <> '' ORDER BY puesto");
  res.json({ departamentos: dep.map((d) => d.nombre), puestos: pue.map((p) => p.puesto) });
}

const ANIO_ACTUAL = () => new Date().getFullYear();

function validarNombreYPuesto(nombre, puesto) {
  const n = String(nombre || "").trim();
  const p = String(puesto || "").trim();
  if (!n || !p) throw httpError(400, "Nombre, puesto y horario son requeridos");
  if (n.length > 80) throw httpError(400, "El nombre no puede exceder 80 caracteres");
  if (p.length > 80) throw httpError(400, "El puesto no puede exceder 80 caracteres");
  return [n, p];
}

// Vacío = se usa la fecha de hoy (ver fechaISO); si se manda, debe ser
// una fecha válida del año en curso.
function validarFechaIngreso(fecha) {
  if (!fecha) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number(fecha.slice(0, 4)) !== ANIO_ACTUAL()) {
    throw httpError(400, `La fecha de ingreso debe ser del año ${ANIO_ACTUAL()}`);
  }
  return fecha;
}

async function listarEmpleados(req, res) {
  const [rows] = await pool.query(
    `SELECT e.id, e.nombre, e.puesto, e.estado, e.fecha_ingreso, e.horario_id,
            d.nombre AS departamento, h.nombre AS horario,
            (SELECT COUNT(*) FROM dispositivos_empleado x WHERE x.empleado_id = e.id AND x.activo = TRUE) AS dispositivos_activos
     FROM empleados e
     JOIN departamentos d ON d.id = e.departamento_id
     JOIN horarios h ON h.id = e.horario_id
     ORDER BY e.id`
  );
  res.json(rows.map((r) => ({ ...r, codigo: codigoDesdeId(r.id) })));
}

async function crearEmpleado(req, res) {
  const { departamento, horarioId, fechaIngreso } = req.body;
  if (!horarioId) throw httpError(400, "Nombre, puesto y horario son requeridos");
  const [nombre, puesto] = validarNombreYPuesto(req.body.nombre, req.body.puesto);
  const fecha = validarFechaIngreso(fechaIngreso);
  const depId = await departamentoId(departamento);
  const [r] = await pool.query(
    "INSERT INTO empleados (nombre, puesto, departamento_id, horario_id, fecha_ingreso) VALUES (?, ?, ?, ?, ?)",
    [nombre, puesto, depId, horarioId, fecha || fechaISO()]
  );
  res.status(201).json({ id: r.insertId, codigo: codigoDesdeId(r.insertId) });
}

async function editarEmpleado(req, res) {
  const { departamento, horarioId, fechaIngreso } = req.body;
  if (!horarioId) throw httpError(400, "Nombre, puesto y horario son requeridos");
  const [nombre, puesto] = validarNombreYPuesto(req.body.nombre, req.body.puesto);
  const fecha = validarFechaIngreso(fechaIngreso);
  const depId = await departamentoId(departamento);
  const [r] = await pool.query(
    "UPDATE empleados SET nombre = ?, puesto = ?, departamento_id = ?, horario_id = ?, fecha_ingreso = ? WHERE id = ?",
    [nombre, puesto, depId, horarioId, fecha, req.params.id]
  );
  if (!r.affectedRows) throw httpError(404, "Empleado no encontrado");
  res.json({ ok: true });
}

// Baja / inactivo revocan sus teléfonos; reactivar requiere un PIN nuevo.
async function cambiarEstado(req, res) {
  const { estado } = req.body;
  if (!["activo", "inactivo", "baja"].includes(estado)) throw httpError(400, "Estado inválido");
  const [r] = await pool.query("UPDATE empleados SET estado = ? WHERE id = ?", [estado, req.params.id]);
  if (!r.affectedRows) throw httpError(404, "Empleado no encontrado");
  if (estado !== "activo") {
    await pool.query(
      `UPDATE dispositivos_empleado
       SET activo = FALSE, fecha_revocacion = NOW(), revocado_por = ?, refresh_token_hash = NULL
       WHERE empleado_id = ? AND activo = TRUE`,
      [req.admin.id, req.params.id]
    );
  }
  res.json({ ok: true });
}

async function generarPinAdmin(req, res) {
  const [r] = await pool.query("SELECT estado FROM empleados WHERE id = ?", [req.params.empleadoId]);
  if (!r[0]) throw httpError(404, "Empleado no encontrado");
  if (r[0].estado !== "activo") throw httpError(400, "El empleado no está activo");
  return generarPin(req, res);
}

// ---------- Dispositivos ----------
async function listarDispositivos(req, res) {
  const [rows] = await pool.query(
    `SELECT id, device_info, pin_usado, activo, fecha_activacion, fecha_revocacion
     FROM dispositivos_empleado WHERE empleado_id = ? ORDER BY id DESC`,
    [req.params.id]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      info: r.device_info,
      pinUsado: !!r.pin_usado,
      activo: !!r.activo,
      fechaActivacion: r.fecha_activacion,
      fechaRevocacion: r.fecha_revocacion,
    }))
  );
}

async function revocarDispositivo(req, res) {
  const [r] = await pool.query(
    `UPDATE dispositivos_empleado
     SET activo = FALSE, fecha_revocacion = NOW(), revocado_por = ?, refresh_token_hash = NULL
     WHERE id = ?`,
    [req.admin.id, req.params.id]
  );
  if (!r.affectedRows) throw httpError(404, "Dispositivo no encontrado");
  res.json({ ok: true });
}

// ---------- Horarios ----------
function leerHorario(b) {
  if (!b.nombre?.trim() || !b.horaEntrada || !b.horaSalida) throw httpError(400, "Nombre, hora de entrada y de salida son requeridos");
  const dias = [...new Set((b.dias || []).map(Number).filter((d) => d >= 1 && d <= 7))];
  if (!dias.length) throw httpError(400, "Elige al menos un día");
  return {
    nombre: b.nombre.trim(),
    entrada: b.horaEntrada,
    salida: b.horaSalida,
    tol: Number(b.toleranciaMinutos ?? 10),
    dur: Number(b.duracionJornadaHoras ?? 10),
    activo: b.activo === false ? 0 : 1,
    dias,
  };
}

async function guardarDias(horarioId, dias) {
  await pool.query("DELETE FROM horarios_dias WHERE horario_id = ?", [horarioId]);
  await pool.query("INSERT INTO horarios_dias (horario_id, dia_semana) VALUES ?", [dias.map((d) => [horarioId, d])]);
}

async function listarHorarios(req, res) {
  const [rows] = await pool.query(
    `SELECT h.*, GROUP_CONCAT(hd.dia_semana ORDER BY hd.dia_semana) AS dias
     FROM horarios h LEFT JOIN horarios_dias hd ON hd.horario_id = h.id
     GROUP BY h.id ORDER BY h.id`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      horaEntrada: hhmmT(r.hora_entrada),
      horaSalida: hhmmT(r.hora_salida),
      toleranciaMinutos: r.tolerancia_minutos,
      duracionJornadaHoras: r.duracion_jornada_horas,
      activo: !!r.activo,
      dias: r.dias ? r.dias.split(",").map(Number) : [],
    }))
  );
}

async function crearHorario(req, res) {
  const h = leerHorario(req.body);
  const [r] = await pool.query(
    "INSERT INTO horarios (nombre, hora_entrada, hora_salida, tolerancia_minutos, duracion_jornada_horas, activo) VALUES (?, ?, ?, ?, ?, ?)",
    [h.nombre, h.entrada, h.salida, h.tol, h.dur, h.activo]
  );
  await guardarDias(r.insertId, h.dias);
  res.status(201).json({ id: r.insertId });
}

async function editarHorario(req, res) {
  const h = leerHorario(req.body);
  const [r] = await pool.query(
    `UPDATE horarios SET nombre = ?, hora_entrada = ?, hora_salida = ?, tolerancia_minutos = ?,
       duracion_jornada_horas = ?, activo = ? WHERE id = ?`,
    [h.nombre, h.entrada, h.salida, h.tol, h.dur, h.activo, req.params.id]
  );
  if (!r.affectedRows) throw httpError(404, "Horario no encontrado");
  await guardarDias(req.params.id, h.dias);
  res.json({ ok: true });
}

// ---------- Asistencias ----------
async function listarAsistencias(req, res) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const desde = re.test(req.query.desde) ? req.query.desde : fechaISO();
  const hasta = re.test(req.query.hasta) ? req.query.hasta : desde;
  const [rows] = await pool.query(
    `SELECT j.id, j.empleado_id, j.fecha, j.hora_entrada, j.hora_salida, j.estado, j.puntualidad,
            j.minutos_retardo, j.foto_entrada_url, j.foto_salida_url, e.nombre
     FROM jornadas j JOIN empleados e ON e.id = j.empleado_id
     WHERE j.fecha BETWEEN ? AND ?
     ORDER BY j.fecha DESC, j.hora_entrada DESC LIMIT 500`,
    [desde, hasta]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      codigo: codigoDesdeId(r.empleado_id),
      nombre: r.nombre,
      horaEntrada: hhmmDT(r.hora_entrada),
      horaSalida: hhmmDT(r.hora_salida),
      estado: r.estado,
      puntualidad: r.puntualidad,
      minutosRetardo: r.minutos_retardo,
      fotoEntrada: r.foto_entrada_url,
      fotoSalida: r.foto_salida_url,
    }))
  );
}

module.exports = {
  login, listarOpciones, listarEmpleados, crearEmpleado, editarEmpleado, cambiarEstado, generarPinAdmin,
  listarDispositivos, revocarDispositivo, listarHorarios, crearHorario, editarHorario, listarAsistencias,
};
