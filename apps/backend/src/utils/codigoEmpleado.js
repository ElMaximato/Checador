// El ID que ve y escribe el empleado (NX-1001, NX-1002...) se deriva del
// id numérico de la tabla `empleados`: id 1 -> NX-1001, id 2 -> NX-1002.
// Así no hace falta una columna extra y los empleados nuevos que cree el
// Admin Web reciben su código automáticamente.
const PREFIJO = "NX-";
const BASE = 1000;

function codigoDesdeId(id) {
  return `${PREFIJO}${BASE + Number(id)}`;
}

// Acepta "NX-1001", "nx-1001" o "NX1001". Devuelve el id numérico o null.
function idDesdeCodigo(codigo) {
  const m = /^NX-?(\d{4,})$/i.exec(String(codigo || "").trim());
  if (!m) return null;
  const id = Number(m[1]) - BASE;
  return Number.isInteger(id) && id >= 1 ? id : null;
}

module.exports = { codigoDesdeId, idDesdeCodigo };
