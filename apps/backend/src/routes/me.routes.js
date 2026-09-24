const router = require("express").Router();
const { requireDeviceSession } = require("../middleware/auth");
const { obtenerPerfil } = require("../controllers/me.controller");

router.get("/", requireDeviceSession, obtenerPerfil);

module.exports = router;
