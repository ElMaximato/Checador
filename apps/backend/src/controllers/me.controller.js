const pool = require("../config/db");
const { codigoDesdeId } = require("../utils/codigoEmpleado");

// GET /api/me — datos del empleado dueño de la sesión del dispositivo:
// nombre, puesto, departamento, ID (NX-1001) y horario asignado.
async function obtenerPerfil(req, res) {
  const [rows] = await pool.query(
    `SELECT e.id, e.nombre, e.puesto, e.estado,
            d.nombre AS departamento,
            h.nombre AS horario_nombre, h.hora_entrada, h.hora_salida
     FROM empleados e
     JOIN departamentos d ON d.id = e.departamento_id
     JOIN horarios h ON h.id = e.horario_id
     WHERE e.id = ?
     LIMIT 1`,
    [req.empleadoId]
  );
  const e = rows[0];
  if (!e) return res.status(404).json({ error: "Empleado no encontrado" });

  res.json({
    id: e.id,
    codigo: codigoDesdeId(e.id),
    nombre: e.nombre,
    puesto: e.puesto,
    departamento: e.departamento,
    estado: e.estado,
    horario: {
      nombre: e.horario_nombre,
      horaEntrada: String(e.hora_entrada).slice(0, 5),
      horaSalida: String(e.hora_salida).slice(0, 5),
    },
  });
}

module.exports = { obtenerPerfil };
