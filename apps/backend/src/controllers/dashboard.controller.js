const pool = require("../config/db");
const { codigoDesdeId } = require("../utils/codigoEmpleado");

const httpError = (status, message) => Object.assign(new Error(message), { status });

const MAX_DIAS = 92; // ~3 meses: el cálculo recorre día por día y empleado por empleado

// Fecha LOCAL en YYYY-MM-DD (no toISOString(): devuelve UTC y rompe el "día").
function fechaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function aFecha(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// Acepta solo fechas reales: "2026-02-31" pasa el regex pero no el viaje de ida y vuelta.
const fechaValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && fechaISO(aFecha(s)) === s;
const diaSemana = (d) => (d.getDay() === 0 ? 7 : d.getDay()); // 1=Lunes ... 7=Domingo
const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : null);

// GET /api/admin/dashboard?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Sin parámetros: del día 1 del mes actual a hoy. Solo cuenta empleados
// activos (no se guarda la fecha de baja, así que no se puede saber desde
// cuándo dejaron de ser esperados).
async function obtenerDashboard(req, res) {
  const hoy = fechaISO(new Date());
  const desde = fechaValida(req.query.desde) ? req.query.desde : `${hoy.slice(0, 8)}01`;
  let hasta = fechaValida(req.query.hasta) ? req.query.hasta : hoy;
  if (hasta > hoy) hasta = hoy; // no hay datos del futuro
  if (desde > hoy) throw httpError(400, "La fecha inicial no puede ser futura");
  if (desde > hasta) throw httpError(400, "La fecha inicial no puede ser posterior a la final");
  const totalDias = Math.round((aFecha(hasta) - aFecha(desde)) / 86_400_000) + 1;
  if (totalDias > MAX_DIAS) throw httpError(400, `El rango no puede exceder ${MAX_DIAS} días`);

  const dias = [];
  for (const c = aFecha(desde); fechaISO(c) <= hasta; c.setDate(c.getDate() + 1)) {
    dias.push({ fecha: fechaISO(c), dow: diaSemana(c) });
  }

  const [empRows] = await pool.query(
    `SELECT e.id, e.nombre, e.horario_id, e.fecha_ingreso, d.id AS dep_id, d.nombre AS departamento
     FROM empleados e JOIN departamentos d ON d.id = e.departamento_id
     WHERE e.estado = 'activo'`
  );
  const [diasRows] = await pool.query("SELECT horario_id, dia_semana FROM horarios_dias");
  const [jorRows] = await pool.query(
    "SELECT empleado_id, fecha, estado, puntualidad, minutos_retardo FROM jornadas WHERE fecha BETWEEN ? AND ?",
    [desde, hasta]
  );

  const emps = new Map();
  const deps = new Map();
  for (const e of empRows) {
    emps.set(e.id, { ...e, retardos: 0, faltas: 0 });
    if (!deps.has(e.dep_id)) {
      deps.set(e.dep_id, { departamento: e.departamento, empleados: 0, jornadas: 0, tarde: 0, minutosRetardo: 0, esperados: 0, asistidos: 0, faltas: 0 });
    }
    deps.get(e.dep_id).empleados++;
  }

  const diasProgramados = new Map(); // horario_id -> Set de días de la semana
  for (const r of diasRows) {
    if (!diasProgramados.has(r.horario_id)) diasProgramados.set(r.horario_id, new Set());
    diasProgramados.get(r.horario_id).add(r.dia_semana);
  }

  const porDia = new Map(dias.map(({ fecha }) => [fecha, { fecha, aTiempo: 0, tarde: 0, faltas: 0, pendientes: 0 }]));
  const t = { aTiempo: 0, tarde: 0, sinSalida: 0, minutosRetardo: 0, esperados: 0, asistidos: 0, faltas: 0 };

  // 1) Jornadas registradas: puntualidad por día, departamento y empleado.
  const registradas = new Set();
  for (const j of jorRows) {
    const e = emps.get(j.empleado_id);
    const dia = porDia.get(j.fecha);
    if (!e || !dia) continue;
    registradas.add(`${j.empleado_id}|${j.fecha}`);
    const dep = deps.get(e.dep_id);
    dep.jornadas++;
    if (j.puntualidad === "a_tiempo") {
      dia.aTiempo++;
      t.aTiempo++;
    } else {
      dia.tarde++;
      t.tarde++;
      t.minutosRetardo += j.minutos_retardo;
      dep.tarde++;
      dep.minutosRetardo += j.minutos_retardo;
      e.retardos++;
    }
    if (j.estado === "expirada_sin_salida") t.sinSalida++;
  }

  // 2) Días que le tocaba trabajar a cada empleado (según el horario que
  // tiene ahora y desde su fecha de ingreso): asistió o faltó. Hoy no se
  // cuenta como falta hasta que termine el día: queda como "pendiente".
  for (const { fecha, dow } of dias) {
    const dia = porDia.get(fecha);
    for (const e of emps.values()) {
      if (e.fecha_ingreso && e.fecha_ingreso > fecha) continue;
      if (!diasProgramados.get(e.horario_id)?.has(dow)) continue;
      const dep = deps.get(e.dep_id);
      if (registradas.has(`${e.id}|${fecha}`)) {
        t.esperados++; t.asistidos++; dep.esperados++; dep.asistidos++;
      } else if (fecha < hoy) {
        t.esperados++; t.faltas++; dia.faltas++; dep.esperados++; dep.faltas++; e.faltas++;
      } else {
        dia.pendientes++;
      }
    }
  }

  const jornadas = t.aTiempo + t.tarde;
  res.json({
    desde,
    hasta,
    resumen: {
      empleadosActivos: emps.size,
      jornadas,
      aTiempo: t.aTiempo,
      tarde: t.tarde,
      sinSalida: t.sinSalida,
      faltas: t.faltas,
      esperados: t.esperados,
      asistenciaPct: pct(t.asistidos, t.esperados),
      puntualidadPct: pct(t.aTiempo, jornadas),
      retardoPromedioMin: t.tarde ? Math.round(t.minutosRetardo / t.tarde) : null,
    },
    porDia: [...porDia.values()],
    porDepartamento: [...deps.values()]
      .map((d) => ({
        departamento: d.departamento,
        empleados: d.empleados,
        jornadas: d.jornadas,
        tarde: d.tarde,
        retardoPct: pct(d.tarde, d.jornadas),
        retardoPromedioMin: d.tarde ? Math.round(d.minutosRetardo / d.tarde) : null,
        faltas: d.faltas,
        asistenciaPct: pct(d.asistidos, d.esperados),
      }))
      .sort((a, b) => b.tarde - a.tarde || a.departamento.localeCompare(b.departamento)),
    incidencias: [...emps.values()]
      .filter((e) => e.retardos + e.faltas > 0)
      .sort((a, b) => b.retardos + b.faltas - (a.retardos + a.faltas))
      .slice(0, 8)
      .map((e) => ({ codigo: codigoDesdeId(e.id), nombre: e.nombre, departamento: e.departamento, retardos: e.retardos, faltas: e.faltas })),
  });
}

module.exports = { obtenerDashboard };