const fs = require("fs");
const { MODO, verificarFoto } = require("../utils/rostro");

const borrar = (ruta) => fs.promises.unlink(ruta).catch(() => {});

// Va DESPUÉS de uploadFoto.single("foto"). Si la foto no muestra un rostro válido,
// la borra del disco y responde 422 con un mensaje que la app enseña tal cual.
async function verificarRostro(req, res, next) {
  if (MODO === "desactivado" || !req.file) return next();

  try {
    const r = await verificarFoto(req.file.path);
    if (!r.ok) {
      await borrar(req.file.path);
      return res.status(422).json({ error: r.error, motivo: r.motivo });
    }
    req.rostro = r;
    return next();
  } catch (err) {
    console.error("[rostro] No se pudo analizar la foto:", err.message);
    if (MODO === "estricto") {
      await borrar(req.file.path);
      return res.status(503).json({ error: "No se pudo verificar la foto. Inténtalo de nuevo en un momento." });
    }
    return next(); // permisivo: no se bloquea la asistencia por una falla del detector
  }
}

module.exports = { verificarRostro };