const router = require("express").Router();
const { requireTv } = require("../middleware/tvAuth");
const { limitarCodigoTv } = require("../middleware/limitarIntentos");
const c = require("../controllers/tvDevice.controller");

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/codigo", limitarCodigoTv, ah(c.pedirCodigo));
router.post("/estado", ah(c.consultarEstado));
router.get("/playlist", ah(requireTv), ah(c.obtenerPlaylist));

router.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Error interno del servidor" });
});

module.exports = router;
