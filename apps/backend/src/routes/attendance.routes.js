const router = require("express").Router();
const { requireDeviceSession } = require("../middleware/auth");
const { uploadFoto } = require("../middleware/upload");
const { registrarEntrada, registrarSalida } = require("../controllers/attendance.controller");

router.post("/entrada", requireDeviceSession, uploadFoto.single("foto"), registrarEntrada);
router.post("/salida", requireDeviceSession, uploadFoto.single("foto"), registrarSalida);

module.exports = router;
