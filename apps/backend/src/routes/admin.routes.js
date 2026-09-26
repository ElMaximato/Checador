const router = require("express").Router();
const { requireAdmin } = require("../middleware/adminAuth");
const c = require("../controllers/admin.controller");

// Express 4 no captura errores de handlers async: se pasan a next().
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/login", ah(c.login));

// Todo lo demás requiere sesión de administrador.
router.use(ah(requireAdmin));

router.get("/empleados", ah(c.listarEmpleados));
router.get("/empleados/opciones", ah(c.listarOpciones));
router.post("/empleados", ah(c.crearEmpleado));
router.put("/empleados/:id", ah(c.editarEmpleado));
router.patch("/empleados/:id/estado", ah(c.cambiarEstado));
router.post("/empleados/:empleadoId/pin", ah(c.generarPinAdmin));
router.get("/empleados/:id/dispositivos", ah(c.listarDispositivos));
router.post("/dispositivos/:id/revocar", ah(c.revocarDispositivo));

router.get("/horarios", ah(c.listarHorarios));
router.post("/horarios", ah(c.crearHorario));
router.put("/horarios/:id", ah(c.editarHorario));

router.get("/asistencias", ah(c.listarAsistencias));

router.use((err, req, res, next) => {
  if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "Horario o departamento inválido" });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Error interno del servidor" });
});

module.exports = router;
