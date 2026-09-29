const router = require("express").Router();
const { requireAdmin, requireSuperAdmin } = require("../middleware/adminAuth");
const { limitarLogin } = require("../middleware/limitarIntentos");
const c = require("../controllers/admin.controller");
const adm = require("../controllers/administradores.controller");
const dash = require("../controllers/dashboard.controller");
const tv = require("../controllers/tvAdmin.controller");
const { uploadMultimedia } = require("../middleware/uploadMultimedia");

// Express 4 no captura errores de handlers async: se pasan a next().
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/login", limitarLogin, ah(c.login));

// Todo lo demás requiere sesión de administrador.
router.use(ah(requireAdmin));

router.get("/dashboard", ah(dash.obtenerDashboard));

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

// Módulo de TV: anuncios, multimedia, playlists y pantallas.
router.get("/tv/anuncios", ah(tv.listarAnuncios));
router.post("/tv/anuncios", ah(tv.crearAnuncio));
router.put("/tv/anuncios/:id", ah(tv.editarAnuncio));
router.delete("/tv/anuncios/:id", ah(tv.eliminarAnuncio));

router.get("/tv/multimedia", ah(tv.listarMultimedia));
router.post("/tv/multimedia", uploadMultimedia, ah(tv.subirMultimedia));
router.put("/tv/multimedia/:id", ah(tv.editarMultimedia));
router.delete("/tv/multimedia/:id", ah(tv.eliminarMultimedia));

router.get("/tv/playlists", ah(tv.listarPlaylists));
router.get("/tv/playlists/:id", ah(tv.obtenerPlaylist));
router.post("/tv/playlists", ah(tv.crearPlaylist));
router.put("/tv/playlists/:id", ah(tv.editarPlaylist));

router.get("/tv/pantallas", ah(tv.listarPantallas));
router.post("/tv/pantallas/emparejar", ah(tv.emparejarPantalla));
router.put("/tv/pantallas/:id", ah(tv.editarPantalla));
router.post("/tv/pantallas/:id/revocar", ah(tv.revocarPantalla));

// Gestión de administradores: solo super_admin.
router.use("/administradores", requireSuperAdmin);
router.get("/administradores", ah(adm.listarAdministradores));
router.post("/administradores", ah(adm.crearAdministrador));
router.put("/administradores/:id", ah(adm.editarAdministrador));
router.patch("/administradores/:id/estado", ah(adm.cambiarEstadoAdministrador));

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "El archivo excede el tamaño máximo permitido" });
  if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "Horario o departamento inválido" });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Error interno del servidor" });
});

module.exports = router;