const jwt = require("jsonwebtoken");
require("dotenv").config();

// Capa 1: token de sesión de dispositivo. Sin expiración por tiempo —
// vive hasta que el admin lo revoque (dispositivos_empleado.activo = false).
function firmarTokenDispositivo({ empleadoId, dispositivoId }) {
  return jwt.sign({ empleadoId, dispositivoId, tipo: "dispositivo" }, process.env.JWT_DEVICE_SECRET);
}

function verificarTokenDispositivo(token) {
  return jwt.verify(token, process.env.JWT_DEVICE_SECRET);
}

// Capa 2: token de jornada. Corta duración (definida por
// horarios.duracion_jornada_horas), uno por empleado por día.
function firmarTokenJornada({ empleadoId, jornadaId }, horas) {
  return jwt.sign({ empleadoId, jornadaId, tipo: "jornada" }, process.env.JWT_JORNADA_SECRET, {
    expiresIn: `${horas}h`,
  });
}

function verificarTokenJornada(token) {
  return jwt.verify(token, process.env.JWT_JORNADA_SECRET);
}

// Capa 3: token de pantalla de TV. Sin expiración por tiempo — vive hasta que
// el admin revoque la TV (dispositivos_tv.estado = 'revocado').
function firmarTokenTv({ dispositivoId }) {
  return jwt.sign({ dispositivoId, tipo: "tv" }, process.env.JWT_TV_SECRET);
}

function verificarTokenTv(token) {
  const p = jwt.verify(token, process.env.JWT_TV_SECRET);
  if (p.tipo !== "tv") throw new Error("Token de tipo incorrecto");
  return p;
}

module.exports = {
  firmarTokenTv,
  verificarTokenTv,
  firmarTokenDispositivo,
  verificarTokenDispositivo,
  firmarTokenJornada,
  verificarTokenJornada,
};
