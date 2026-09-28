const pool = require("../config/db");
const { firmarTokenJornada } = require("../utils/tokens");
const {
  fechaISO,
  diaISO,
  masDias,
  esNocturno,
  turnoDelDia,
  resolverTurnoEntrada,
  calcularPuntualidad,
  inicioVentanaEntrada,
} = require("../utils/turnos");

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

// La salida cae en un día distinto al de la entrada (turno nocturno).
const salidaOtroDia = (entrada, salida) => !!salida && fechaISO(parseDT(entrada)) !== fechaISO(parseDT(salida));

const DIAS_CORTOS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

// Horario activo del empleado + los días de la semana en que aplica.
async function obtenerHorarioEmpleado(empleadoId) {
  const [rows] = await pool.query(
    `SELECT h.*, GROUP_CONCAT(hd.dia_semana) AS dias
     FROM empleados e
     JOIN horarios h ON h.id = e.horario_id
     LEFT JOIN horarios_dias hd ON hd.horario_id = h.id
     WHERE e.id = ? AND h.activo = TRUE
     GROUP BY h.id`,
    [empleadoId]
  );
  const h = rows[0];
  if (!h) return null;
  return { horario: h, dias: new Set((h.dias || "").split(",").filter(Boolean).map(Number)) };
}

// Jornada abierta del empleado (aunque haya empezado ayer): activa y con el token vigente.
async function buscarJornadaActiva(empleadoId, ahora) {
  const [rows] = await pool.query(
    `SELECT * FROM jornadas
     WHERE empleado_id = ? AND estado = 'activa' AND hora_expiracion_token > ?
     ORDER BY hora_entrada DESC LIMIT 1`,
    [empleadoId, ahora]
  );
  return rows[0] || null;
}

// POST /api/attendance/entrada  (multipart/form-data, campo "foto")
async function registrarEntrada(req, res) {
  const empleadoId = req.empleadoId;
  const dispositivoId = req.dispositivoId;

  if (!req.file) return res.status(400).json({ error: "Falta la foto de evidencia" });

  const ahora = new Date();
  const datos = await obtenerHorarioEmpleado(empleadoId);
  if (!datos) return res.status(400).json({ error: "El empleado no tiene horario asignado para hoy" });
  const { horario, dias } = datos;

  // A qué turno pertenece esta entrada (para un turno nocturno puede ser el de ayer).
  const { turno, error } = resolverTurnoEntrada(horario, dias, ahora);
  if (!turno) return res.status(400).json({ error });

  const [existentes] = await pool.query(
    "SELECT id FROM jornadas WHERE empleado_id = ? AND fecha = ?",
    [empleadoId, turno.fecha]
  );
  if (existentes.length > 0) {
    return res.status(409).json({
      error: turno.fecha === hoyISO() ? "Ya existe un registro de entrada para hoy" : "Ya existe un registro de entrada para este turno",
    });
  }

  const { puntualidad, minutosRetardo } = calcularPuntualidad(turno, horario.tolerancia_minutos, ahora);

  const horaExpiracion = new Date(ahora.getTime() + horario.duracion_jornada_horas * 3600_000);
  const fotoUrl = `/uploads/asistencia/${req.file.filename}`;

  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO jornadas
         (empleado_id, dispositivo_id, fecha, hora_entrada, hora_expiracion_token,
          token_jornada_hash, estado, puntualidad, minutos_retardo, foto_entrada_url)
       VALUES (?, ?, ?, ?, ?, '', 'activa', ?, ?, ?)`,
      [empleadoId, dispositivoId, turno.fecha, ahora, horaExpiracion, puntualidad, minutosRetardo, fotoUrl]
    );
  } catch (err) {
    // Dos peticiones a la vez: gana la primera, la otra choca con uq_empleado_fecha.
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ya existe un registro de entrada para este turno" });
    throw err;
  }

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

  if (!req.file) return res.status(400).json({ error: "Falta la foto de evidencia" });

  const ahora = new Date();
  // Se busca la jornada abierta, no la de "hoy": un turno nocturno empezó ayer.
  const jornada = await buscarJornadaActiva(empleadoId, ahora);
  if (!jornada) {
    const [ultimas] = await pool.query(
      "SELECT id FROM jornadas WHERE empleado_id = ? AND fecha >= ? LIMIT 1",
      [empleadoId, fechaISO(masDias(ahora, -1))]
    );
    if (!ultimas.length) return res.status(404).json({ error: "No hay una entrada registrada hoy" });
    return res.status(409).json({ error: "La jornada de hoy ya no está activa (cerrada o expirada)" });
  }

  const fotoUrl = `/uploads/asistencia/${req.file.filename}`;
  const jornadaTotalMs = ahora - parseDT(jornada.hora_entrada);
  const horas = Math.floor(jornadaTotalMs / 3600_000);
  const minutos = Math.round((jornadaTotalMs % 3600_000) / 60_000);

  // `estado = 'activa'` evita cerrar dos veces si llegan dos peticiones a la vez.
  const [upd] = await pool.query(
    "UPDATE jornadas SET hora_salida = ?, foto_salida_url = ?, estado = 'cerrada' WHERE id = ? AND estado = 'activa'",
    [ahora, fotoUrl, jornada.id]
  );
  if (!upd.affectedRows) return res.status(409).json({ error: "La jornada de hoy ya no está activa (cerrada o expirada)" });

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

// Turno de ayer que terminó (o expiró) ya en el día de hoy y que la app todavía debe mostrar
// como "jornada de hoy": cerrado a las 06:00, sigue siendo lo que el empleado ve por la mañana.
// Deja de mostrarse cuando se abre la ventana de entrada del turno nocturno de hoy.
async function turnoDeAyerVisibleHoy(empleadoId, ahora) {
  const [rows] = await pool.query(
    `SELECT estado, puntualidad, hora_entrada, hora_salida, hora_expiracion_token
     FROM jornadas WHERE empleado_id = ? AND fecha = ? LIMIT 1`,
    [empleadoId, fechaISO(masDias(ahora, -1))]
  );
  const j = rows[0];
  if (!j) return null;
  if (fechaISO(parseDT(j.hora_salida || j.hora_expiracion_token)) !== hoyISO()) return null; // terminó ayer

  const datos = await obtenerHorarioEmpleado(empleadoId);
  if (datos && esNocturno(datos.horario) && datos.dias.has(diaISO(ahora))) {
    if (ahora >= inicioVentanaEntrada(datos.horario, ahora)) return null;
  }
  return j;
}

// GET /api/attendance/hoy — estado de la jornada en curso o de hoy del empleado
// (o null si aún no ha checado entrada). El móvil lo usa para decidir
// si mostrar "Registrar entrada" o "Registrar salida", y para el
// tiempo trabajado del día.
async function obtenerJornadaHoy(req, res) {
  const empleadoId = req.empleadoId;
  const ahora = new Date();

  // 1) Jornada abierta (en un turno nocturno puede haber empezado ayer).
  let jornada = await buscarJornadaActiva(empleadoId, ahora);

  // 2) La de hoy (cerrada o expirada).
  if (!jornada) {
    const [rows] = await pool.query(
      `SELECT estado, puntualidad, hora_entrada, hora_salida, hora_expiracion_token
       FROM jornadas WHERE empleado_id = ? AND fecha = ? LIMIT 1`,
      [empleadoId, hoyISO()]
    );
    jornada = rows[0] || null;
  }

  // 3) Un turno nocturno de ayer que cerró esta madrugada.
  if (!jornada) jornada = await turnoDeAyerVisibleHoy(empleadoId, ahora);

  if (!jornada) return res.json({ jornada: null });

  // Activa pero con el token vencido (el job aún no la marca): ya no admite salida.
  const estado =
    jornada.estado === "activa" && parseDT(jornada.hora_expiracion_token) <= ahora ? "expirada_sin_salida" : jornada.estado;

  const entrada = parseDT(jornada.hora_entrada);
  let minutosTrabajados = null;
  if (jornada.hora_salida) {
    minutosTrabajados = Math.max(0, Math.round((parseDT(jornada.hora_salida) - entrada) / 60_000));
  } else if (estado === "activa") {
    minutosTrabajados = Math.max(0, Math.floor((ahora - entrada) / 60_000));
  }

  res.json({
    jornada: {
      estado,
      puntualidad: jornada.puntualidad,
      horaEntrada: hhmm(jornada.hora_entrada),
      horaSalida: jornada.hora_salida ? hhmm(jornada.hora_salida) : null,
      salidaDiaSiguiente: salidaOtroDia(jornada.hora_entrada, jornada.hora_salida),
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
      salidaDiaSiguiente: salidaOtroDia(j.hora_entrada, j.hora_salida),
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