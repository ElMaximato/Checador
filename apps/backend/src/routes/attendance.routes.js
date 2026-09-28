const router = require("express").Router();
const { requireDeviceSession } = require("../middleware/auth");
const { uploadFoto } = require("../middleware/upload");
const { verificarRostro } = require("../middleware/verificarRostro");
const { registrarEntrada, registrarSalida, obtenerJornadaHoy, obtenerHistorial } = require("../controllers/attendance.controller");

// Express 4 no captura errores de handlers async: se pasan a next().
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/hoy", requireDeviceSession, ah(obtenerJornadaHoy));
router.get("/historial", requireDeviceSession, ah(obtenerHistorial));
router.post("/entrada", requireDeviceSession, uploadFoto.single("foto"), ah(verificarRostro), ah(registrarEntrada));
router.post("/salida", requireDeviceSession, uploadFoto.single("foto"), ah(verificarRostro), ah(registrarSalida));

module.exports = router;