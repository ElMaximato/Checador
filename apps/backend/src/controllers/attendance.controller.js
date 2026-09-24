const pool = require("../config/db");
const { firmarTokenJornada } = require("../utils/tokens");

// Fecha LOCAL del servidor en formato YYYY-MM-DD.
// (No usar toISOString(): devuelve la fecha en UTC y el "día" cambiaba
// a las 5 pm en Sonora, guardando jornadas con la fecha del día siguiente.)
function fechaISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function hoyISO() {
  return fechaISO(new Date());
}

// La BD devuelve los DATETIME como texto ("2026-09-23 19:56:05", hora local).
function parseDT(valor) {
  return new Date(String(valor).replace(" ", "T"));
}

function hhmm(valor) {
  return parseDT(valor).toTimeString().slice(0, 5);
}

const DIAS_CORTOS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

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

// GET /api/attendance/hoy — estado de la jornada de hoy del empleado
// (o null si aún no ha checado entrada). El móvil lo usa para decidir
// si mostrar "Registrar entrada" o "Registrar salida", y para el
// tiempo trabajado del día.
async function obtenerJornadaHoy(req, res) {
  const empleadoId = req.empleadoId;
  const fecha = hoyISO();

  const [rows] = await pool.query(
    "SELECT estado, puntualidad, hora_entrada, hora_salida FROM jornadas WHERE empleado_id = ? AND fecha = ? LIMIT 1",
    [empleadoId, fecha]
  );
  const jornada = rows[0];
  if (!jornada) return res.json({ jornada: null });

  const entrada = parseDT(jornada.hora_entrada);
  let minutosTrabajados = null;
  if (jornada.hora_salida) {
    minutosTrabajados = Math.max(0, Math.round((parseDT(jornada.hora_salida) - entrada) / 60_000));
  } else if (jornada.estado === "activa") {
    minutosTrabajados = Math.max(0, Math.floor((Date.now() - entrada) / 60_000));
  }

  res.json({
    jornada: {
      estado: jornada.estado,
      puntualidad: jornada.puntualidad,
      horaEntrada: hhmm(jornada.hora_entrada),
      horaSalida: jornada.hora_salida ? hhmm(jornada.hora_salida) : null,
      minutosTrabajados,
    },
  });
}

// GET /api/attendance/historial?mes=YYYY-MM
// Registros del mes del empleado + resumen (días laborados, horas,
// puntualidad y asistencia). Sin ?mes= usa el mes actual.
async function obtenerHistorial(req, res) {
  const empleadoId = req.empleadoId;
  const hoy = hoyISO();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes || "") ? req.query.mes : hoy.slice(0, 7);

  const [anio, mesNum] = mes.split("-").map(Number);
  const ultimoDia = new Date(anio, mesNum, 0).getDate();
  const desde = `${mes}-01`;
  const hasta = `${mes}-${String(ultimoDia).padStart(2, "0")}`;

  const [rows] = await pool.query(
    `SELECT fecha, hora_entrada, hora_salida, estado, puntualidad
     FROM jornadas
     WHERE empleado_id = ? AND fecha BETWEEN ? AND ?
     ORDER BY fecha DESC`,
    [empleadoId, desde, hasta]
  );

  const registros = rows.map((j) => {
    const [y, m, d] = j.fecha.split("-").map(Number);
    const entrada = parseDT(j.hora_entrada);
    const salida = j.hora_salida ? parseDT(j.hora_salida) : null;
    return {
      fecha: j.fecha,
      dia: String(d).padStart(2, "0"),
      diaSemana: DIAS_CORTOS[new Date(y, m - 1, d).getDay()],
      horaEntrada: hhmm(j.hora_entrada),
      horaSalida: salida ? hhmm(j.hora_salida) : null,
      minutosTotales: salida ? Math.max(0, Math.round((salida - entrada) / 60_000)) : null,
      puntualidad: j.puntualidad,
      estado: j.estado,
    };
  });

  // Días que le correspondía trabajar en el mes, hasta hoy (o hasta el
  // fin de mes si ya pasó), a partir de su fecha de ingreso. El día de
  // hoy solo cuenta si ya checó, para no penalizar antes de que llegue.
  const [diasRows] = await pool.query(
    `SELECT hd.dia_semana, e.fecha_ingreso
     FROM empleados e
     JOIN horarios_dias hd ON hd.horario_id = e.horario_id
     WHERE e.id = ?`,
    [empleadoId]
  );
  const diasProgramados = new Set(diasRows.map((r) => r.dia_semana));
  const fechaIngreso = diasRows[0]?.fecha_ingreso || null;

  const inicio = fechaIngreso && fechaIngreso > desde ? fechaIngreso : desde;
  const fin = hasta < hoy ? hasta : hoy;
  const fechasConJornada = new Set(registros.map((r) => r.fecha));

  let diasEsperados = 0;
  if (inicio <= fin) {
    const cursor = new Date(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)) - 1, Number(inicio.slice(8, 10)));
    while (fechaISO(cursor) <= fin) {
      const f = fechaISO(cursor);
      const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
      if (diasProgramados.has(dow) && (f !== hoy || fechasConJornada.has(f))) diasEsperados++;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const minutosTotales = registros.reduce((acc, r) => acc + (r.minutosTotales || 0), 0);
  const aTiempo = registros.filter((r) => r.puntualidad === "a_tiempo").length;

  res.json({
    mes,
    resumen: {
      diasLaborados: registros.length,
      minutosTotales,
      puntualidadPct: registros.length ? Math.round((aTiempo / registros.length) * 100) : null,
      asistenciaPct: diasEsperados > 0 ? Math.min(100, Math.round((registros.length / diasEsperados) * 100)) : null,
      diasEsperados,
    },
    registros,
  });
}

module.exports = { registrarEntrada, registrarSalida, obtenerJornadaHoy, obtenerHistorial };
