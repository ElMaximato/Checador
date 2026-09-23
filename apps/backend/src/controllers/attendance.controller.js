const pool = require("../config/db");
const { firmarTokenJornada } = require("../utils/tokens");

function hoyISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function sumarMinutos(hora, minutos) {
  const [h, m, s] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${s ? String(s).padStart(2, "0") : "00"}`;
}

async function obtenerHorarioDeHoy(empleadoId) {
  const diaSemana = new Date().getDay() === 0 ? 7 : new Date().getDay(); // 1=Lunes...7=Domingo
  const [rows] = await pool.query(
    `SELECT h.* FROM horarios h
     JOIN empleados e ON e.horario_id = h.id
     JOIN horarios_dias hd ON hd.horario_id = h.id
     WHERE e.id = ? AND hd.dia_semana = ? AND h.activo = TRUE
     LIMIT 1`,
    [empleadoId, diaSemana]
  );
  return rows[0] || null;
}

// POST /api/attendance/entrada  (multipart/form-data, campo "foto")
async function registrarEntrada(req, res) {
  const empleadoId = req.empleadoId;
  const dispositivoId = req.dispositivoId;
  const fecha = hoyISO();

  if (!req.file) return res.status(400).json({ error: "Falta la foto de evidencia" });

  const [existentes] = await pool.query(
    "SELECT id FROM jornadas WHERE empleado_id = ? AND fecha = ?",
    [empleadoId, fecha]
  );
  if (existentes.length > 0) {
    return res.status(409).json({ error: "Ya existe un registro de entrada para hoy" });
  }

  const horario = await obtenerHorarioDeHoy(empleadoId);
  if (!horario) return res.status(400).json({ error: "El empleado no tiene horario asignado para hoy" });

  const ahora = new Date();
  const horaActual = ahora.toTimeString().slice(0, 8);
  const limiteATiempo = sumarMinutos(horario.hora_entrada, horario.tolerancia_minutos);

  const puntualidad = horaActual <= limiteATiempo ? "a_tiempo" : "tarde";
  const minutosRetardo =
    puntualidad === "tarde"
      ? Math.round((toSeconds(horaActual) - toSeconds(limiteATiempo)) / 60)
      : 0;

  const horaExpiracion = new Date(ahora.getTime() + horario.duracion_jornada_horas * 3600_000);
  const fotoUrl = `/uploads/asistencia/${req.file.filename}`;

  const [result] = await pool.query(
    `INSERT INTO jornadas
       (empleado_id, dispositivo_id, fecha, hora_entrada, hora_expiracion_token,
        token_jornada_hash, estado, puntualidad, minutos_retardo, foto_entrada_url)
     VALUES (?, ?, ?, ?, ?, '', 'activa', ?, ?, ?)`,
    [empleadoId, dispositivoId, fecha, ahora, horaExpiracion, puntualidad, minutosRetardo, fotoUrl]
  );

  const tokenJornada = firmarTokenJornada(
    { empleadoId, jornadaId: result.insertId },
    horario.duracion_jornada_horas
  );
  await pool.query("UPDATE jornadas SET token_jornada_hash = ? WHERE id = ?", [tokenJornada, result.insertId]);

  const io = req.app.get("io");
  if (io) {
    io.emit("nuevo-registro", {
      empleadoId,
      tipo: "entrada",
      hora: ahora.toTimeString().slice(0, 5),
      puntualidad,
      fotoUrl,
    });
  }

  res.json({
    tipo: "entrada",
    hora: ahora.toTimeString().slice(0, 5),
    puntualidad,
    minutosRetardo,
    tokenJornada,
  });
}

// POST /api/attendance/salida  (multipart/form-data, campo "foto")
async function registrarSalida(req, res) {
  const empleadoId = req.empleadoId;
  const fecha = hoyISO();

  if (!req.file) return res.status(400).json({ error: "Falta la foto de evidencia" });

  const [rows] = await pool.query(
    "SELECT * FROM jornadas WHERE empleado_id = ? AND fecha = ? LIMIT 1",
    [empleadoId, fecha]
  );
  const jornada = rows[0];
  if (!jornada) return res.status(404).json({ error: "No hay una entrada registrada hoy" });
  if (jornada.estado !== "activa") {
    return res.status(409).json({ error: "La jornada de hoy ya no está activa (cerrada o expirada)" });
  }

  const ahora = new Date();
  const fotoUrl = `/uploads/asistencia/${req.file.filename}`;
  const jornadaTotalMs = ahora - new Date(jornada.hora_entrada);
  const horas = Math.floor(jornadaTotalMs / 3600_000);
  const minutos = Math.round((jornadaTotalMs % 3600_000) / 60_000);

  await pool.query(
    "UPDATE jornadas SET hora_salida = ?, foto_salida_url = ?, estado = 'cerrada' WHERE id = ?",
    [ahora, fotoUrl, jornada.id]
  );

  const io = req.app.get("io");
  if (io) {
    io.emit("nuevo-registro", {
      empleadoId,
      tipo: "salida",
      hora: ahora.toTimeString().slice(0, 5),
      puntualidad: jornada.puntualidad,
      fotoUrl,
    });
  }

  res.json({
    tipo: "salida",
    hora: ahora.toTimeString().slice(0, 5),
    puntualidad: jornada.puntualidad,
    jornadaTotal: `${horas} h ${minutos} min`,
  });
}

function toSeconds(hhmmss) {
  const [h, m, s = 0] = hhmmss.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

module.exports = { registrarEntrada, registrarSalida };
