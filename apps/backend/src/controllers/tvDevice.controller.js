// Endpoints públicos que usa la pantalla de TV (apps/tv).
const crypto = require("crypto");
const pool = require("../config/db");
const { firmarTokenTv } = require("../utils/tokens");

const httpError = (status, message) => Object.assign(new Error(message), { status });

const CODIGO_VIDA_MIN = 15;
// Sin O/0, I/1/L para que se pueda dictar y leer desde lejos sin confusiones.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generarCodigo = () => Array.from(crypto.randomBytes(6), (b) => ALFABETO[b % ALFABETO.length]).join("");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// La TV pide un código para mostrar en pantalla. Recibe además un "claim":
// secreto que solo ella conoce y con el que después reclama su token.
async function pedirCodigo(req, res) {
  // Limpieza: pendientes vencidos hace más de 1 h (así una TV que consulta
  // justo después de vencer todavía recibe "expirado" y no un 404).
  await pool.query("DELETE FROM dispositivos_tv WHERE estado = 'pendiente' AND codigo_expira < NOW() - INTERVAL 1 HOUR");

  const claim = crypto.randomBytes(24).toString("hex");
  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigo();
    try {
      const [r] = await pool.query(
        `INSERT INTO dispositivos_tv (nombre, estado, codigo_emparejamiento, codigo_expira, claim_hash)
         VALUES ('TV sin emparejar', 'pendiente', ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
        [codigo, CODIGO_VIDA_MIN, sha256(claim)]
      );
      return res.json({ dispositivoId: r.insertId, codigo, claim, expiraMin: CODIGO_VIDA_MIN });
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") throw err; // código repetido: se reintenta con otro
    }
  }
  throw httpError(503, "No se pudo generar un código. Inténtalo de nuevo.");
}

// La TV pregunta si ya fue emparejada. El token se entrega una sola vez.
async function consultarEstado(req, res) {
  const id = Number(req.body?.dispositivoId);
  const claim = String(req.body?.claim || "");
  if (!Number.isInteger(id) || !claim) throw httpError(400, "Datos incompletos");

  const [rows] = await pool.query(
    "SELECT id, nombre, estado, claim_hash, codigo_expira < NOW() AS vencido FROM dispositivos_tv WHERE id = ? LIMIT 1",
    [id]
  );
  const d = rows[0];
  // Sin fila o sin claim pendiente (token ya entregado): esta TV debe pedir un código nuevo.
  if (!d || !d.claim_hash) return res.json({ estado: "expirado" });

  const a = Buffer.from(sha256(claim));
  const b = Buffer.from(d.claim_hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw httpError(403, "Solicitud no válida");

  if (d.estado === "revocado") return res.json({ estado: "revocado" });
  if (d.estado === "pendiente") return res.json({ estado: d.vencido ? "expirado" : "pendiente" });

  // Emparejada: se entrega el token y se borra el claim en una sola operación,
  // para que dos consultas simultáneas no obtengan dos tokens.
  const [r] = await pool.query("UPDATE dispositivos_tv SET claim_hash = NULL WHERE id = ? AND claim_hash IS NOT NULL", [id]);
  if (!r.affectedRows) return res.json({ estado: "expirado" });
  res.json({ estado: "emparejado", token: firmarTokenTv({ dispositivoId: id }), nombre: d.nombre });
}

// Lo que debe reproducir la TV: playlist asignada + anuncios vigentes + música de fondo.
async function obtenerPlaylist(req, res) {
  const tv = req.tv;
  await pool.query("UPDATE dispositivos_tv SET ultimo_ping = NOW() WHERE id = ?", [tv.id]);

  let items = [];
  if (tv.playlist_activa_id) {
    const [rows] = await pool.query(
      `SELECT m.id, m.tipo, m.nombre, m.url, m.duracion_seg, pi.duracion_override
       FROM playlist_items pi
       JOIN playlists p ON p.id = pi.playlist_id AND p.activo = TRUE
       JOIN multimedia m ON m.id = pi.multimedia_id AND m.activo = TRUE
       WHERE pi.playlist_id = ? ORDER BY pi.orden`,
      [tv.playlist_activa_id]
    );
    items = rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      nombre: r.nombre,
      url: r.url,
      duracionSeg: r.duracion_override ?? r.duracion_seg ?? null,
    }));
  }

  // Música predeterminada: solo si la playlist no trae música propia (la propia siempre manda).
  let musicaFondo = [];
  if (!items.some((i) => i.tipo === "musica")) {
    const [fondo] = await pool.query(
      "SELECT id, nombre, url FROM multimedia WHERE tipo = 'musica' AND predeterminada = TRUE AND activo = TRUE ORDER BY id"
    );
    musicaFondo = fondo.map((m) => ({ id: m.id, nombre: m.nombre, url: m.url }));
  }

  const [anuncios] = await pool.query(
    `SELECT id, titulo, contenido FROM anuncios
     WHERE activo = TRUE AND NOW() BETWEEN fecha_inicio AND fecha_fin ORDER BY fecha_inicio, id`
  );

  const contenido = { items, anuncios, musicaFondo };
  // La TV compara la versión y solo reconstruye su cola si algo cambió.
  const version = crypto.createHash("sha1").update(JSON.stringify(contenido)).digest("hex").slice(0, 12);
  res.json({ dispositivo: { id: tv.id, nombre: tv.nombre }, version, ...contenido });
}

module.exports = { pedirCodigo, consultarEstado, obtenerPlaylist };
