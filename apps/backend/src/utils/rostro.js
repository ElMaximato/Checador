// Verificación de rostro en las fotos de asistencia.
//
// Usa @vladmandic/human (detector BlazeFace sobre TensorFlow.js con backend WASM,
// sin GPU ni compilación nativa) y sharp para decodificar la imagen.
// Solo se activa el detector de rostros: nada de malla, iris, emociones, etc.
//
// Modos (variable VERIFICAR_ROSTRO):
//   estricto    -> sin rostro válido la foto se rechaza; si el detector falla, también.
//   permisivo   -> sin rostro válido la foto se rechaza; si el detector FALLA (error
//                  interno), la foto pasa y se registra el error en consola. (por defecto)
//   desactivado -> no se revisa nada.

const fs = require("fs");
const path = require("path");

const MODO = (process.env.VERIFICAR_ROSTRO || "permisivo").toLowerCase();
const LADO_MAX = 640; // la foto se reduce a este lado máximo antes de detectar
const PUNTAJE_MIN = Number(process.env.ROSTRO_PUNTAJE_MIN) || 0.5;
// Lado del rostro relativo al lado corto de la foto. Un selfie normal ronda 0.35–0.6.
const TAMANO_MIN = Number(process.env.ROSTRO_TAMANO_MIN) || 0.15;

const MSG = {
  sinRostro: "No detectamos un rostro en la foto. Mira de frente a la cámara, con buena luz, e inténtalo de nuevo.",
  variosRostros: "Se detectó más de un rostro. La foto debe mostrar solo a la persona que registra su asistencia.",
  muyLejos: "Tu rostro se ve muy pequeño. Acércate a la cámara e inténtalo de nuevo.",
};

// --- Reglas (función pura, se puede probar sin el detector) ---------------
// `caras`: [{ box: [x, y, w, h], puntaje }] en píxeles de la imagen analizada.
function evaluarCaras(caras, ancho, alto) {
  const validas = (caras || []).filter((c) => c.puntaje >= PUNTAJE_MIN);
  if (!validas.length) return { ok: false, motivo: "sin_rostro", error: MSG.sinRostro };

  const area = (c) => c.box[2] * c.box[3];
  const principal = validas.reduce((a, b) => (area(b) > area(a) ? b : a));

  // Personas al fondo (rostros mucho más chicos que el principal) no cuentan.
  const relevantes = validas.filter((c) => area(c) >= area(principal) * 0.25);
  if (relevantes.length > 1) return { ok: false, motivo: "varios_rostros", error: MSG.variosRostros };

  const lado = Math.sqrt(area(principal));
  if (lado < Math.min(ancho, alto) * TAMANO_MIN) return { ok: false, motivo: "muy_lejos", error: MSG.muyLejos };

  return { ok: true, puntaje: principal.puntaje };
}

// --- Detector (carga perezosa, una sola instancia) -------------------------

function resolverRutas() {
  const dist = path.dirname(require.resolve("@vladmandic/human")); // .../@vladmandic/human/dist
  let wasm;
  try {
    wasm = path.join(path.dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json")), "dist");
  } catch {
    wasm = path.join(process.cwd(), "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist");
  }
  return {
    bundle: path.join(dist, "human.node-wasm.js"), // ruta absoluta: evita el mapa "exports" del paquete
    modelos: process.env.HUMAN_MODELS_DIR || path.join(dist, "..", "models"),
    wasm,
  };
}

// TensorFlow.js carga los modelos con fetch(); el fetch nativo de Node no entiende file://.
// Este parche solo atiende URLs file:// y deja pasar todo lo demás.
function habilitarFetchArchivos() {
  if (globalThis.__fetchArchivosListo) return;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = typeof url === "string" ? url : url?.url || String(url);
    if (!u.startsWith("file://")) return original(url, init);
    try {
      const ruta = decodeURIComponent(u.replace(/^file:\/\/\/?/, process.platform === "win32" ? "" : "/"));
      const datos = await fs.promises.readFile(ruta);
      const tipo = ruta.endsWith(".json") ? "application/json" : "application/octet-stream";
      return new Response(datos, { status: 200, headers: { "content-type": tipo } });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  globalThis.__fetchArchivosListo = true;
}

let humanPromesa = null;

function cargarDetector() {
  if (humanPromesa) return humanPromesa;
  humanPromesa = (async () => {
    const rutas = resolverRutas();
    if (!fs.existsSync(path.join(rutas.modelos, "blazeface.json"))) {
      throw new Error(`No se encontró blazeface.json en ${rutas.modelos} (revisa HUMAN_MODELS_DIR)`);
    }
    habilitarFetchArchivos();

    const mod = require(rutas.bundle);
    const Human = mod.Human || mod.default || mod;
    const human = new Human({
      backend: "wasm",
      wasmPath: rutas.wasm.replace(/\\/g, "/") + "/",
      modelBasePath: "file://" + rutas.modelos.replace(/\\/g, "/") + "/",
      debug: false,
      async: false,
      cacheSensitivity: 0, // cada foto es independiente: sin caché entre fotos
      filter: { enabled: false },
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 4, minConfidence: 0.4 },
        mesh: { enabled: false },
        iris: { enabled: false },
        description: { enabled: false },
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      segmentation: { enabled: false },
    });
    await human.load();
    return human;
  })().catch((err) => {
    humanPromesa = null; // permite reintentar en la siguiente foto
    throw err;
  });
  return humanPromesa;
}

// El detector no admite dos detecciones simultáneas: se encolan.
let cola = Promise.resolve();
function enCola(tarea) {
  const r = cola.then(tarea, tarea);
  cola = r.catch(() => {});
  return r;
}

async function detectarCaras(rutaArchivo) {
  const sharp = require("sharp");
  const human = await cargarDetector();
  // .rotate() aplica la orientación EXIF (las cámaras móviles suelen guardar la foto girada).
  // failOn: "none": las cámaras de teléfono a veces generan JPEG con irregularidades menores
  // (p. ej. "Invalid SOS parameters") que sharp trata como error por defecto, aunque la imagen se ve bien.
  const { data, info } = await sharp(rutaArchivo, { failOn: "none" })
    .rotate()
    .resize({ width: LADO_MAX, height: LADO_MAX, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = human.tf.tensor(new Int32Array(data), [info.height, info.width, 3], "int32");
  try {
    const resultado = await human.detect(tensor);
    const caras = (resultado.face || []).map((f) => ({
      box: f.box,
      puntaje: f.boxScore ?? f.faceScore ?? f.score ?? 0,
    }));
    return { caras, ancho: info.width, alto: info.height };
  } finally {
    human.tf.dispose(tensor);
  }
}

// Analiza una foto guardada en disco. Devuelve { ok, motivo?, error?, puntaje? }.
// Lanza si el detector o la imagen fallan (el middleware decide qué hacer según el modo).
function verificarFoto(rutaArchivo) {
  return enCola(async () => {
    const { caras, ancho, alto } = await detectarCaras(rutaArchivo);
    return evaluarCaras(caras, ancho, alto);
  });
}

// Para calentar el detector al arrancar el servidor (y ver en consola si funciona).
function precalentar() {
  return enCola(() => cargarDetector());
}

module.exports = { MODO, verificarFoto, precalentar, evaluarCaras, MSG };