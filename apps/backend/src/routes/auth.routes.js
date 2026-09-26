const router = require("express").Router();
const { requireDeviceSession } = require("../middleware/auth");
const { activarDispositivo, desvincularDispositivo } = require("../controllers/auth.controller");

// (generar PIN ahora vive en /api/admin/empleados/:id/pin, protegido por login de administrador)

// Llamado desde la app móvil, primera vez que se instala
router.post("/activar", activarDispositivo);

// Llamado desde la app móvil: el empleado desvincula su propio teléfono
router.post("/desvincular", requireDeviceSession, desvincularDispositivo);

module.exports = router;
