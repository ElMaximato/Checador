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
const NOMBRE_HORARIO_MAX = 80;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/; // HH:MM o HH:MM:SS
const aMinutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Entero obligatorio dentro de [min, max]. Si el campo no viene (undefined/null)
// se usa `porDefecto`; un texto vacío o no numérico se rechaza (antes "" pasaba como 0).
function entero(valor, etiqueta, min, max, porDefecto) {
  if (valor === undefined || valor === null) return porDefecto;
  const n = typeof valor === "string" && valor.trim() === "" ? NaN : Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw httpError(400, `${etiqueta} debe ser un número entero entre ${min} y ${max}`);
  }
  return n;
}

function leerHorario(b) {
  const nombre = String(b.nombre ?? "").trim();
  if (!nombre) throw httpError(400, "El nombre del horario es requerido");
  if (nombre.length > NOMBRE_HORARIO_MAX) throw httpError(400, `El nombre no puede exceder ${NOMBRE_HORARIO_MAX} caracteres`);

  if (!HORA_RE.test(String(b.horaEntrada ?? ""))) throw httpError(400, "La hora de entrada no es válida (HH:MM)");
  if (!HORA_RE.test(String(b.horaSalida ?? ""))) throw httpError(400, "La hora de salida no es válida (HH:MM)");
  const entrada = b.horaEntrada.slice(0, 5);
  const salida = b.horaSalida.slice(0, 5);
  const difMin = aMinutos(salida) - aMinutos(entrada);
  if (difMin === 0) throw httpError(400, "La hora de salida no puede ser igual a la de entrada");
  // Salida menor que entrada = turno nocturno: cruza la medianoche y termina al día siguiente.
  const turnoMin = difMin > 0 ? difMin : difMin + 1440;

  const tol = entero(b.toleranciaMinutos, "La tolerancia", 0, 120, 10);
  const dur = entero(b.duracionJornadaHoras, "La vigencia de la jornada", 1, 24, 10);
  // El token de jornada vive `dur` horas desde la entrada: si es menor que el turno,
  // vence antes de la salida y la jornada queda "expirada_sin_salida".
  const turnoHoras = Math.ceil(turnoMin / 60);
  if (dur < turnoHoras) {
    throw httpError(400, `La vigencia de la jornada (${dur} h) debe cubrir el turno (${turnoHoras} h); si no, vence antes de poder registrar la salida`);
  }

  const dias = [...new Set((Array.isArray(b.dias) ? b.dias : []).map(Number))];
  if (dias.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw httpError(400, "Los días deben ir de 1 (lunes) a 7 (domingo)");
  if (!dias.length) throw httpError(400, "Elige al menos un día");

  return { nombre, entrada, salida, tol, dur, activo: b.activo === false ? 0 : 1, dias };
}

async function verificarNombreHorarioLibre(nombre, exceptoId = 0) {
  const [r] = await pool.query("SELECT id FROM horarios WHERE nombre = ? AND id <> ? LIMIT 1", [nombre, exceptoId]);
  if (r.length) throw httpError(409, "Ya existe un horario con ese nombre");
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
  await verificarNombreHorarioLibre(h.nombre);
  const [r] = await pool.query(
    "INSERT INTO horarios (nombre, hora_entrada, hora_salida, tolerancia_minutos, duracion_jornada_horas, activo) VALUES (?, ?, ?, ?, ?, ?)",
    [h.nombre, h.entrada, h.salida, h.tol, h.dur, h.activo]
  );
  await guardarDias(r.insertId, h.dias);
  res.status(201).json({ id: r.insertId });
}

async function editarHorario(req, res) {
  const h = leerHorario(req.body);
  await verificarNombreHorarioLibre(h.nombre, Number(req.params.id) || 0);
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
const LIMITE_DEFECTO = 50;
const LIMITE_MAX = 200;

// "YYYY-MM-DD" que además sea una fecha real (rechaza 2026-02-31).
function fechaValida(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Entero >= 1; si no es válido usa `defecto`. Se acota a `max`.
function enteroPositivo(v, defecto, max = Infinity) {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : defecto;
}

// GET /asistencias?desde&hasta&pagina&limite
// Responde { filas, total, pagina, limite, paginas }. Si piden una página
// mayor a la última, devuelve la última (y `pagina` refleja cuál es).
async function listarAsistencias(req, res) {
  const { desde: d, hasta: h } = req.query;
  if (d !== undefined && !fechaValida(d)) throw httpError(400, "La fecha inicial no es válida (AAAA-MM-DD)");
  if (h !== undefined && !fechaValida(h)) throw httpError(400, "La fecha final no es válida (AAAA-MM-DD)");
  const desde = d ?? fechaISO();
  const hasta = h ?? desde;
  if (desde > hasta) throw httpError(400, "La fecha inicial no puede ser posterior a la final");

  const limite = enteroPositivo(req.query.limite, LIMITE_DEFECTO, LIMITE_MAX);
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM jornadas WHERE fecha BETWEEN ? AND ?", [desde, hasta]);
  const paginas = Math.max(1, Math.ceil(total / limite));
  const pagina = Math.min(enteroPositivo(req.query.pagina, 1), paginas);

  const [rows] = await pool.query(
    `SELECT j.id, j.empleado_id, j.fecha, j.hora_entrada, j.hora_salida, j.estado, j.puntualidad,
            j.minutos_retardo, j.foto_entrada_url, j.foto_salida_url, e.nombre
     FROM jornadas j JOIN empleados e ON e.id = j.empleado_id
     WHERE j.fecha BETWEEN ? AND ?
     ORDER BY j.fecha DESC, j.hora_entrada DESC, j.id DESC
     LIMIT ? OFFSET ?`,
    [desde, hasta, limite, (pagina - 1) * limite]
  );
  res.json({
    filas: rows.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      codigo: codigoDesdeId(r.empleado_id),
      nombre: r.nombre,
      horaEntrada: hhmmDT(r.hora_entrada),
      horaSalida: hhmmDT(r.hora_salida),
      salidaDiaSiguiente: !!r.hora_salida && String(r.hora_salida).slice(0, 10) !== String(r.hora_entrada).slice(0, 10),
      estado: r.estado,
      puntualidad: r.puntualidad,
      minutosRetardo: r.minutos_retardo,
      fotoEntrada: r.foto_entrada_url,
      fotoSalida: r.foto_salida_url,
    })),
    total,
    pagina,
    limite,
    paginas,
  });
}

module.exports = {
  login, listarOpciones, listarEmpleados, crearEmpleado, editarEmpleado, cambiarEstado, generarPinAdmin,
  listarDispositivos, revocarDispositivo, listarHorarios, crearHorario, editarHorario, listarAsistencias,
};