// Panel de administración del módulo de TV: anuncios, multimedia, playlists y pantallas.
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const { tipoDesdeMime, DIR_MULTIMEDIA } = require("../middleware/uploadMultimedia");

const httpError = (status, message) => Object.assign(new Error(message), { status });
const idParam = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw httpError(400, "Id inválido");
  return n;
};

// ---------- Anuncios ----------
const TITULO_MAX = 200;
const CONTENIDO_MAX = 2000;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
const aDatetime = (v) => {
  const s = String(v || "").trim();
  if (!FECHA_RE.test(s)) return null;
  const f = s.replace("T", " ");
  return f.length === 16 ? `${f}:00` : f;
};
const aInput = (v) => String(v).slice(0, 16).replace(" ", "T"); // DATETIME -> "YYYY-MM-DDTHH:mm"

function leerAnuncio(b) {
  const titulo = String(b.titulo || "").trim();
  const contenido = String(b.contenido || "").trim();
  const inicio = aDatetime(b.fechaInicio);
  const fin = aDatetime(b.fechaFin);
  if (!titulo) throw httpError(400, "El título es requerido");
  if (titulo.length > TITULO_MAX) throw httpError(400, `El título no puede exceder ${TITULO_MAX} caracteres`);
  if (!contenido) throw httpError(400, "El contenido es requerido");
  if (contenido.length > CONTENIDO_MAX) throw httpError(400, `El contenido no puede exceder ${CONTENIDO_MAX} caracteres`);
  if (!inicio || !fin) throw httpError(400, "Indica fecha de inicio y de fin");
  if (fin <= inicio) throw httpError(400, "La fecha de fin debe ser posterior a la de inicio");
  return { titulo, contenido, inicio, fin, activo: b.activo !== false };
}

async function listarAnuncios(req, res) {
  const [rows] = await pool.query(
    `SELECT a.id, a.titulo, a.contenido, a.fecha_inicio, a.fecha_fin, a.activo,
            (a.activo AND NOW() BETWEEN a.fecha_inicio AND a.fecha_fin) AS vigente,
            (a.fecha_fin < NOW()) AS vencido, (a.fecha_inicio > NOW()) AS programado,
            ad.nombre AS creado_por
     FROM anuncios a JOIN admins ad ON ad.id = a.creado_por
     ORDER BY a.fecha_inicio DESC, a.id DESC`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      contenido: r.contenido,
      fechaInicio: aInput(r.fecha_inicio),
      fechaFin: aInput(r.fecha_fin),
      activo: !!r.activo,
      estado: !r.activo ? "inactivo" : r.vencido ? "vencido" : r.programado ? "programado" : "vigente",
      creadoPor: r.creado_por,
    }))
  );
}

async function crearAnuncio(req, res) {
  const a = leerAnuncio(req.body);
  const [r] = await pool.query(
    "INSERT INTO anuncios (titulo, contenido, fecha_inicio, fecha_fin, activo, creado_por) VALUES (?, ?, ?, ?, ?, ?)",
    [a.titulo, a.contenido, a.inicio, a.fin, a.activo, req.admin.id]
  );
  res.status(201).json({ id: r.insertId });
}

async function editarAnuncio(req, res) {
  const a = leerAnuncio(req.body);
  const [r] = await pool.query(
    "UPDATE anuncios SET titulo = ?, contenido = ?, fecha_inicio = ?, fecha_fin = ?, activo = ? WHERE id = ?",
    [a.titulo, a.contenido, a.inicio, a.fin, a.activo, idParam(req.params.id)]
  );
  if (!r.affectedRows) throw httpError(404, "Anuncio no encontrado");
  res.json({ ok: true });
}

async function eliminarAnuncio(req, res) {
  const [r] = await pool.query("DELETE FROM anuncios WHERE id = ?", [idParam(req.params.id)]);
  if (!r.affectedRows) throw httpError(404, "Anuncio no encontrado");
  res.json({ ok: true });
}

// ---------- Multimedia ----------
const NOMBRE_MAX = 200;
const quitarArchivo = (url) => {
  // url guardada: /uploads/multimedia/<archivo>. Solo se toca el nombre base.
  fs.unlink(path.join(DIR_MULTIMEDIA, path.basename(url)), () => {});
};

async function listarMultimedia(req, res) {
  const [rows] = await pool.query(
    `SELECT m.id, m.tipo, m.nombre, m.url, m.tamano_bytes, m.activo, m.predeterminada, m.created_at,
            (SELECT COUNT(*) FROM playlist_items pi WHERE pi.multimedia_id = m.id) AS usos
     FROM multimedia m ORDER BY m.id DESC`
  );
  res.json(
    rows.map((r) => ({
      id: r.id, tipo: r.tipo, nombre: r.nombre, url: r.url,
      tamanoBytes: r.tamano_bytes === null ? null : Number(r.tamano_bytes),
      activo: !!r.activo, predeterminada: !!r.predeterminada, usos: Number(r.usos), fecha: r.created_at,
    }))
  );
}

async function subirMultimedia(req, res) {
  const f = req.file;
  if (!f) throw httpError(400, "Elige un archivo");
  const tipo = tipoDesdeMime(f.mimetype);
  // multer entrega el nombre original como latin1; se recodifica a UTF-8 (acentos, ñ).
  const original = Buffer.from(f.originalname, "latin1").toString("utf8").replace(path.extname(f.originalname), "");
  const nombre = (String(req.body.nombre || "").trim() || original).slice(0, NOMBRE_MAX);
  if (!nombre) {
    quitarArchivo(f.filename);
    throw httpError(400, "Escribe un nombre");
  }
  // Solo la música puede ser predeterminada; en otros tipos la marca se ignora.
  const predeterminada = tipo === "musica" && String(req.body.predeterminada) === "true";
  try {
    const [r] = await pool.query(
      "INSERT INTO multimedia (tipo, nombre, url, tamano_bytes, predeterminada, subido_por) VALUES (?, ?, ?, ?, ?, ?)",
      [tipo, nombre, `/uploads/multimedia/${f.filename}`, f.size, predeterminada, req.admin.id]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    quitarArchivo(f.filename); // no dejar el archivo huérfano si falló el INSERT
    throw err;
  }
}

async function editarMultimedia(req, res) {
  const nombre = String(req.body.nombre || "").trim();
  if (!nombre) throw httpError(400, "El nombre es requerido");
  if (nombre.length > NOMBRE_MAX) throw httpError(400, `El nombre no puede exceder ${NOMBRE_MAX} caracteres`);
  const id = idParam(req.params.id);
  const [filas] = await pool.query("SELECT tipo FROM multimedia WHERE id = ?", [id]);
  if (!filas[0]) throw httpError(404, "Archivo no encontrado");
  const predeterminada = req.body.predeterminada === true;
  if (predeterminada && filas[0].tipo !== "musica") throw httpError(400, "Solo la música puede ser predeterminada");
  await pool.query("UPDATE multimedia SET nombre = ?, activo = ?, predeterminada = ? WHERE id = ?", [
    nombre, req.body.activo !== false, predeterminada, id,
  ]);
  res.json({ ok: true });
}

async function eliminarMultimedia(req, res) {
  const id = idParam(req.params.id);
  const [rows] = await pool.query(
    "SELECT m.url, (SELECT COUNT(*) FROM playlist_items WHERE multimedia_id = m.id) AS usos FROM multimedia m WHERE m.id = ?",
    [id]
  );
  if (!rows[0]) throw httpError(404, "Archivo no encontrado");
  if (Number(rows[0].usos) > 0) {
    throw httpError(409, `Está en ${rows[0].usos} lugar(es) de playlists. Quítalo de ahí o desactívalo en lugar de eliminarlo.`);
  }
  await pool.query("DELETE FROM multimedia WHERE id = ?", [id]);
  quitarArchivo(rows[0].url);
  res.json({ ok: true });
}

// ---------- Playlists ----------
const ITEMS_MAX = 200;

function leerPlaylist(b) {
  const nombre = String(b.nombre || "").trim();
  if (!nombre) throw httpError(400, "El nombre es requerido");
  if (nombre.length > 150) throw httpError(400, "El nombre no puede exceder 150 caracteres");
  const crudos = b.items === undefined ? [] : b.items;
  if (!Array.isArray(crudos) || crudos.length > ITEMS_MAX) throw httpError(400, `La playlist admite hasta ${ITEMS_MAX} elementos`);
  const items = crudos.map((it) => {
    const multimediaId = Number(it?.multimediaId);
    const d = it?.duracionOverride;
    const duracion = d === null || d === undefined || d === "" ? null : Number(d);
    if (!Number.isInteger(multimediaId) || multimediaId < 1) throw httpError(400, "Elemento de playlist inválido");
    if (duracion !== null && (!Number.isInteger(duracion) || duracion < 1 || duracion > 3600)) {
      throw httpError(400, "La duración debe ser un entero entre 1 y 3600 segundos");
    }
    return { multimediaId, duracion };
  });
  return { nombre, activo: b.activo !== false, items };
}

// Reemplaza por completo los elementos de la playlist, en una transacción
// (UNIQUE (playlist_id, orden) impide ir moviendo fila por fila).
async function guardarItems(conn, playlistId, items) {
  if (items.length) {
    const ids = [...new Set(items.map((i) => i.multimediaId))];
    const [ok] = await conn.query("SELECT id FROM multimedia WHERE id IN (?)", [ids]);
    if (ok.length !== ids.length) throw httpError(400, "Alguno de los archivos ya no existe");
  }
  await conn.query("DELETE FROM playlist_items WHERE playlist_id = ?", [playlistId]);
  if (items.length) {
    await conn.query("INSERT INTO playlist_items (playlist_id, multimedia_id, orden, duracion_override) VALUES ?", [
      items.map((it, i) => [playlistId, it.multimediaId, i + 1, it.duracion]),
    ]);
  }
}

async function enTransaccion(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listarPlaylists(req, res) {
  const [rows] = await pool.query(
    `SELECT p.id, p.nombre, p.activo,
            (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id) AS items,
            (SELECT COUNT(*) FROM dispositivos_tv d WHERE d.playlist_activa_id = p.id AND d.estado = 'emparejado') AS pantallas
     FROM playlists p ORDER BY p.id DESC`
  );
  res.json(rows.map((r) => ({ id: r.id, nombre: r.nombre, activo: !!r.activo, items: Number(r.items), pantallas: Number(r.pantallas) })));
}

async function obtenerPlaylist(req, res) {
  const id = idParam(req.params.id);
  const [p] = await pool.query("SELECT id, nombre, activo FROM playlists WHERE id = ?", [id]);
  if (!p[0]) throw httpError(404, "Playlist no encontrada");
  const [items] = await pool.query(
    `SELECT m.id AS multimedia_id, m.tipo, m.nombre, m.url, pi.duracion_override
     FROM playlist_items pi JOIN multimedia m ON m.id = pi.multimedia_id
     WHERE pi.playlist_id = ? ORDER BY pi.orden`,
    [id]
  );
  res.json({
    id: p[0].id, nombre: p[0].nombre, activo: !!p[0].activo,
    items: items.map((i) => ({ multimediaId: i.multimedia_id, tipo: i.tipo, nombre: i.nombre, url: i.url, duracionOverride: i.duracion_override })),
  });
}

async function crearPlaylist(req, res) {
  const p = leerPlaylist(req.body);
  const id = await enTransaccion(async (conn) => {
    const [r] = await conn.query("INSERT INTO playlists (nombre, activo) VALUES (?, ?)", [p.nombre, p.activo]);
    await guardarItems(conn, r.insertId, p.items);
    return r.insertId;
  });
  res.status(201).json({ id });
}

async function editarPlaylist(req, res) {
  const id = idParam(req.params.id);
  const p = leerPlaylist(req.body);
  await enTransaccion(async (conn) => {
    const [r] = await conn.query("UPDATE playlists SET nombre = ?, activo = ? WHERE id = ?", [p.nombre, p.activo, id]);
    if (!r.affectedRows) throw httpError(404, "Playlist no encontrada");
    await guardarItems(conn, id, p.items);
  });
  res.json({ ok: true });
}

// ---------- Pantallas de TV ----------
const TV_NOMBRE_MAX = 100;
const TV_UBICACION_MAX = 150;

async function playlistIdOpcional(v) {
  if (v === null || v === undefined || v === "") return null;
  const id = idParam(v);
  const [r] = await pool.query("SELECT id FROM playlists WHERE id = ?", [id]);
  if (!r[0]) throw httpError(400, "La playlist elegida no existe");
  return id;
}

function leerPantalla(b) {
  const nombre = String(b.nombre || "").trim();
  const ubicacion = String(b.ubicacion || "").trim();
  if (!nombre) throw httpError(400, "El nombre de la pantalla es requerido");
  if (nombre.length > TV_NOMBRE_MAX) throw httpError(400, `El nombre no puede exceder ${TV_NOMBRE_MAX} caracteres`);
  if (ubicacion.length > TV_UBICACION_MAX) throw httpError(400, `La ubicación no puede exceder ${TV_UBICACION_MAX} caracteres`);
  return { nombre, ubicacion: ubicacion || null };
}

async function listarPantallas(req, res) {
  // La TV consulta cada ~60 s: sin señal en 3 min se considera fuera de línea.
  const [rows] = await pool.query(
    `SELECT d.id, d.nombre, d.ubicacion, d.estado, d.playlist_activa_id, p.nombre AS playlist_nombre,
            d.ultimo_ping, (d.ultimo_ping >= NOW() - INTERVAL 3 MINUTE) AS en_linea
     FROM dispositivos_tv d LEFT JOIN playlists p ON p.id = d.playlist_activa_id
     WHERE d.estado <> 'pendiente' ORDER BY d.id DESC`
  );
  res.json(
    rows.map((r) => ({
      id: r.id, nombre: r.nombre, ubicacion: r.ubicacion, estado: r.estado,
      playlistId: r.playlist_activa_id, playlistNombre: r.playlist_nombre,
      ultimoPing: r.ultimo_ping, enLinea: !!r.en_linea,
    }))
  );
}

async function emparejarPantalla(req, res) {
  const codigo = String(req.body.codigo || "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (!codigo) throw httpError(400, "Escribe el código que aparece en la TV");
  const datos = leerPantalla(req.body);
  const playlistId = await playlistIdOpcional(req.body.playlistId);
  const [r] = await pool.query(
    `UPDATE dispositivos_tv
     SET nombre = ?, ubicacion = ?, playlist_activa_id = ?, estado = 'emparejado', activo = TRUE,
         codigo_emparejamiento = NULL, codigo_expira = NULL
     WHERE codigo_emparejamiento = ? AND estado = 'pendiente' AND codigo_expira > NOW()`,
    [datos.nombre, datos.ubicacion, playlistId, codigo]
  );
  if (!r.affectedRows) throw httpError(404, "Código inválido o vencido. Revisa la pantalla de la TV.");
  res.json({ ok: true });
}

async function editarPantalla(req, res) {
  const datos = leerPantalla(req.body);
  const playlistId = await playlistIdOpcional(req.body.playlistId);
  const [r] = await pool.query(
    "UPDATE dispositivos_tv SET nombre = ?, ubicacion = ?, playlist_activa_id = ? WHERE id = ? AND estado = 'emparejado'",
    [datos.nombre, datos.ubicacion, playlistId, idParam(req.params.id)]
  );
  if (!r.affectedRows) throw httpError(404, "Pantalla no encontrada o revocada");
  res.json({ ok: true });
}

async function revocarPantalla(req, res) {
  const [r] = await pool.query(
    "UPDATE dispositivos_tv SET estado = 'revocado', activo = FALSE, claim_hash = NULL WHERE id = ? AND estado = 'emparejado'",
    [idParam(req.params.id)]
  );
  if (!r.affectedRows) throw httpError(404, "Pantalla no encontrada o ya revocada");
  res.json({ ok: true });
}

module.exports = {
  listarAnuncios, crearAnuncio, editarAnuncio, eliminarAnuncio,
  listarMultimedia, subirMultimedia, editarMultimedia, eliminarMultimedia,
  listarPlaylists, obtenerPlaylist, crearPlaylist, editarPlaylist,
  listarPantallas, emparejarPantalla, editarPantalla, revocarPantalla,
};
