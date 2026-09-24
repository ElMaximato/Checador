const router = require("express").Router();
const { requireDeviceSession } = require("../middleware/auth");
const { uploadFoto } = require("../middleware/upload");
const { registrarEntrada, registrarSalida, obtenerJornadaHoy, obtenerHistorial } = require("../controllers/attendance.controller");

router.get("/hoy", requireDeviceSession, obtenerJornadaHoy);
router.get("/historial", requireDeviceSession, obtenerHistorial);
router.post("/entrada", requireDeviceSession, uploadFoto.single("foto"), registrarEntrada);
router.post("/salida", requireDeviceSession, uploadFoto.single("foto"), registrarSalida);

module.exports = router;
