const router = require("express").Router();
const { requireDeviceSession } = require("../middleware/auth");
const { generarPin, activarDispositivo, desvincularDispositivo } = require("../controllers/auth.controller");

// Llamado desde el Admin Web (debe protegerse con auth de admin — ver nota)
router.post("/dispositivos/:empleadoId/generar-pin", generarPin);

// Llamado desde la app móvil, primera vez que se instala
router.post("/activar", activarDispositivo);

// Llamado desde la app móvil: el empleado desvincula su propio teléfono
router.post("/desvincular", requireDeviceSession, desvincularDispositivo);

module.exports = router;
