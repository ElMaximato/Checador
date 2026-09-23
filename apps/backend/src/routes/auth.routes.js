const router = require("express").Router();
const { generarPin, activarDispositivo } = require("../controllers/auth.controller");

// Llamado desde el Admin Web (debe protegerse con auth de admin — ver nota)
router.post("/dispositivos/:empleadoId/generar-pin", generarPin);

// Llamado desde la app móvil, primera vez que se instala
router.post("/activar", activarDispositivo);

module.exports = router;
