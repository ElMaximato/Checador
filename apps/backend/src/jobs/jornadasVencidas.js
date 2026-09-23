const cron = require("node-cron");
const pool = require("../config/db");

// Corre cada 10 minutos. Cualquier jornada 'activa' cuyo token de 10h
// ya expiró y no tiene hora_salida queda marcada para revisión manual
// del admin, tal como se definió: no se autocompleta la hora de salida.
function iniciarJobJornadasVencidas() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const [result] = await pool.query(
        `UPDATE jornadas
         SET estado = 'expirada_sin_salida'
         WHERE estado = 'activa' AND hora_expiracion_token < NOW()`
      );
      if (result.affectedRows > 0) {
        console.log(`[cron] ${result.affectedRows} jornada(s) marcada(s) como expirada_sin_salida`);
      }
    } catch (err) {
      console.error("[cron] Error revisando jornadas vencidas:", err.message);
    }
  });
}

module.exports = { iniciarJobJornadasVencidas };
