// Prueba la verificación de rostro con fotos reales, sin levantar el servidor.
//   node scripts/probarRostro.js foto1.jpg foto2.jpg ...
// Sirve para confirmar que las librerías y modelos quedaron bien instaladas.
const { verificarFoto } = require("../src/utils/rostro");

(async () => {
  const fotos = process.argv.slice(2);
  if (!fotos.length) {
    console.log("Uso: node scripts/probarRostro.js <foto> [<foto> ...]");
    process.exit(1);
  }
  for (const f of fotos) {
    const t0 = Date.now();
    try {
      const r = await verificarFoto(f);
      console.log(`${r.ok ? "OK      " : "RECHAZO "} ${f}  ${r.ok ? `puntaje ${r.puntaje.toFixed(2)}` : `${r.motivo}`}  (${Date.now() - t0} ms)`);
    } catch (err) {
      console.error(`ERROR    ${f}: ${err.message}`);
    }
  }
  process.exit(0);
})();