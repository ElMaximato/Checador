const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { firmarTokenDispositivo } = require("../utils/tokens");

// Llamado por el Admin Web al dar de alta a un empleado (o al
// reemplazar su teléfono). Genera un PIN de un solo uso.
async function generarPin(req, res) {
  const { empleadoId } = req.params;

  const [empleados] = await pool.query("SELECT id FROM empleados WHERE id = ?", [empleadoId]);
  if (empleados.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });

  const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
  const pinHash = await bcrypt.hash(pin, 10);

  // Cualquier dispositivo previo del empleado que aún no haya sido
  // activado con su propio PIN se invalida al generar uno nuevo.
  await pool.query(
    "DELETE FROM dispositivos_empleado WHERE empleado_id = ? AND pin_usado = FALSE",
    [empleadoId]
  );

  const [result] = await pool.query(
    "INSERT INTO dispositivos_empleado (empleado_id, device_id, pin_hash, pin_usado, activo) VALUES (?, '', ?, FALSE, FALSE)",
    [empleadoId, pinHash]
  );

  // El PIN en claro solo se devuelve aquí, una vez, para que RH lo
  // comparta con el empleado. Nunca se vuelve a poder consultar.
  res.json({ dispositivoRegistroId: result.insertId, pin });
}

// Llamado por la app móvil la primera vez que el empleado la abre.
async function activarDispositivo(req, res) {
  const { empleadoId, pin, deviceId, deviceInfo } = req.body;
  if (!empleadoId || !pin || !deviceId) {
    return res.status(400).json({ error: "empleadoId, pin y deviceId son requeridos" });
  }

  const [rows] = await pool.query(
    "SELECT * FROM dispositivos_empleado WHERE empleado_id = ? AND pin_usado = FALSE ORDER BY id DESC LIMIT 1",
    [empleadoId]
  );
  const registro = rows[0];
  if (!registro) return res.status(400).json({ error: "No hay un PIN pendiente para este empleado" });

  const valido = await bcrypt.compare(pin, registro.pin_hash);
  if (!valido) return res.status(401).json({ error: "PIN incorrecto" });

  await pool.query(
    `UPDATE dispositivos_empleado
     SET device_id = ?, device_info = ?, pin_usado = TRUE, activo = TRUE, fecha_activacion = NOW()
     WHERE id = ?`,
    [deviceId, deviceInfo || null, registro.id]
  );

  const token = firmarTokenDispositivo({ empleadoId, dispositivoId: registro.id });
  res.json({ token });
}

module.exports = { generarPin, activarDispositivo };
