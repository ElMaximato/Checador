// App de TV: emparejamiento por código + reproducción de playlist con anuncios.
// HTML/CSS/JS sin build, pensada para abrirse en modo kiosco en el navegador de la pantalla.
"use strict";

const SEG_IMAGEN = 10;          // segundos por imagen si la playlist no indica otra duración
const CADA_N_ELEMENTOS = 3;     // se intercala un anuncio cada N elementos de la playlist
const REFRESCO_MS = 60 * 1000;  // cada cuánto se pregunta al servidor por cambios (también es el "ping")
const SONDEO_EMPAREJAR_MS = 4000;
const ESPERA_MEDIO_MS = 20 * 1000; // si un video/audio no arranca en este tiempo, se salta

// ---------- Lógica pura (se prueba sin navegador) ----------
function segundosAnuncio(a) {
  const largo = (a.titulo + " " + a.contenido).length;
  return Math.max(10, Math.min(40, Math.round(largo / 15)));
}

// Mezcla playlist y anuncios en una sola cola circular.
function construirCola(items, anuncios, cada = CADA_N_ELEMENTOS) {
  const cola = [];
  let k = 0;
  const anuncio = () => ({ tipo: "anuncio", ...anuncios[k++ % anuncios.length] });
  items.forEach((it, i) => {
    cola.push(it);
    if (anuncios.length && (i + 1) % cada === 0) cola.push(anuncio());
  });
  if (anuncios.length && k === 0) anuncios.forEach(() => cola.push(anuncio())); // playlist corta o vacía
  return cola;
}

if (typeof document === "undefined") {
  module.exports = { construirCola, segundosAnuncio };
} else {
  // ---------- Configuración ----------
  const params = new URLSearchParams(location.search);
  if (params.get("reset")) { localStorage.removeItem("tv_token"); localStorage.removeItem("tv_api"); }
  if (params.get("api")) localStorage.setItem("tv_api", params.get("api").replace(/\/+$/, ""));
  // Servida por el backend (/tv/) el API es el mismo origen; si no, se indica una vez con ?api=http://servidor:4000
  const API = localStorage.getItem("tv_api") || (location.protocol === "file:" ? "" : location.origin);

  const $ = (id) => document.getElementById(id);
  const pantallas = { emparejar: $("pantalla-emparejar"), reproduccion: $("pantalla-reproduccion"), espera: $("pantalla-espera") };
  const mostrar = (nombre) => Object.entries(pantallas).forEach(([k, el]) => (el.hidden = k !== nombre));
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  class NoAutorizado extends Error {}

  async function peticion(ruta, { method = "GET", body, token } = {}) {
    if (!API) throw new Error("Falta la dirección del servidor: abre esta página con ?api=http://servidor:4000");
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(API + ruta, {
        method,
        signal: ctl.signal,
        headers: { ...(body && { "Content-Type": "application/json" }), ...(token && { Authorization: `Bearer ${token}` }) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new NoAutorizado();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  // ---------- Emparejamiento ----------
  async function emparejar() {
    mostrar("emparejar");
    for (;;) {
      let sol;
      try {
        sol = await peticion("/api/tv/codigo", { method: "POST" });
      } catch (err) {
        $("estado-emparejar").textContent = `No se pudo pedir el código: ${err.message}. Reintentando…`;
        await dormir(10000);
        continue;
      }
      $("codigo").textContent = sol.codigo;
      $("estado-emparejar").textContent = `El código vence en ${sol.expiraMin} minutos.`;

      for (;;) {
        await dormir(SONDEO_EMPAREJAR_MS);
        let r;
        try {
          r = await peticion("/api/tv/estado", { method: "POST", body: { dispositivoId: sol.dispositivoId, claim: sol.claim } });
        } catch { continue; } // sin red un momento: se sigue intentando
        if (r.estado === "emparejado") { localStorage.setItem("tv_token", r.token); return r.token; }
        if (r.estado === "expirado" || r.estado === "revocado") break; // se pide un código nuevo
      }
    }
  }

  // ---------- Música de fondo (predeterminada) ----------
  // Suena bajo las imágenes y anuncios cuando la playlist no trae música propia
  // (el servidor manda la lista vacía si la trae). Se pausa mientras corre un video.
  const fondo = { lista: [], idx: 0, clave: "", enPausa: false, audio: new Audio() };
  fondo.audio.volume = 0.5;
  fondo.audio.onended = () => siguienteFondo();
  fondo.audio.onerror = () => { if (fondo.lista.length > 1) setTimeout(siguienteFondo, 1500); }; // pista rota: se salta

  function intentarFondo() {
    if (fondo.lista.length && !fondo.enPausa && fondo.audio.paused) fondo.audio.play().catch(() => {}); // bloqueado: se reintenta luego
  }
  function ponerPista(i) {
    fondo.idx = i % fondo.lista.length;
    fondo.audio.src = API + fondo.lista[fondo.idx].url;
    intentarFondo();
  }
  function siguienteFondo() {
    if (fondo.lista.length) ponerPista(fondo.idx + 1);
  }
  function actualizarFondo(lista) {
    const clave = lista.map((m) => `${m.id}:${m.url}`).join("|");
    if (clave === fondo.clave) return; // sin cambios: no se interrumpe la pista en curso
    fondo.clave = clave;
    fondo.lista = lista;
    if (!lista.length) {
      fondo.audio.pause();
      fondo.audio.removeAttribute("src");
      fondo.audio.load();
      return;
    }
    ponerPista(Math.floor(Math.random() * lista.length));
  }
  const pausarFondo = () => { fondo.enPausa = true; fondo.audio.pause(); };
  const reanudarFondo = () => { fondo.enPausa = false; intentarFondo(); };
  // Si el navegador bloqueó el audio automático, el primer toque o tecla del control lo activa.
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, intentarFondo));

  // ---------- Reproducción ----------
  const escena = $("escena");
  let cola = [];
  let colaNueva = null;   // cambios recibidos: se aplican al terminar el elemento actual
  let fondoNuevo = [];    // música de fondo que llega junto con colaNueva
  let version = null;
  let posicion = 0;
  let cancelarActual = () => {};
  let generacion = 0;     // sube al revocarse la TV: detiene el bucle de la sesión anterior

  function diapositiva(clase, ...hijos) {
    const d = document.createElement("div");
    d.className = `diapositiva ${clase}`;
    d.append(...hijos);
    escena.replaceChildren(d);
    return d;
  }
  const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

  // Muestra un elemento y resuelve cuando termina. `cancelarActual` permite cortarlo.
  function reproducir(it) {
    return new Promise((resolver) => {
      let temporizador, vigilante;
      const fin = () => {
        clearTimeout(temporizador); clearTimeout(vigilante); cancelarActual = () => {};
        if (it.tipo === "video") reanudarFondo();
        resolver();
      };
      cancelarActual = fin;
      if (it.tipo === "video") pausarFondo(); else intentarFondo();

      if (it.tipo === "anuncio") {
        diapositiva("anuncio", el("small", { textContent: "Aviso" }), el("h2", { textContent: it.titulo }), el("p", { textContent: it.contenido }));
        temporizador = setTimeout(fin, segundosAnuncio(it) * 1000);
      } else if (it.tipo === "imagen") {
        const img = el("img", { src: API + it.url, alt: "" });
        img.onerror = () => setTimeout(fin, 1000);
        diapositiva("", img);
        temporizador = setTimeout(fin, (it.duracionSeg || SEG_IMAGEN) * 1000);
      } else {
        // video o música: dura lo que dure el archivo
        const medio = el(it.tipo === "video" ? "video" : "audio", { src: API + it.url, autoplay: true, playsInline: true });
        medio.onended = fin;
        medio.onerror = () => setTimeout(fin, 1000);
        medio.onplaying = () => clearTimeout(vigilante);
        if (it.tipo === "video") diapositiva("", medio);
        else diapositiva("musica", el("h2", { textContent: it.nombre }), Object.assign(el("div", { className: "barras" }), { innerHTML: "<i></i><i></i><i></i><i></i><i></i>" }), medio);
        vigilante = setTimeout(fin, ESPERA_MEDIO_MS); // no arrancó: se salta
        // Algunos navegadores bloquean el audio sin interacción: se reintenta en silencio.
        medio.play().catch(() => { medio.muted = true; medio.play().catch(() => {}); });
      }
    });
  }

  async function cargarContenido(token) {
    const d = await peticion("/api/tv/playlist", { token });
    if (d.version === version) return;
    version = d.version;
    colaNueva = construirCola(d.items, d.anuncios);
    fondoNuevo = d.musicaFondo || [];
    if (!cola.length) aplicarCola(); // primera carga o pantalla vacía: se aplica ya
  }

  function aplicarCola() {
    if (!colaNueva) return;
    cola = colaNueva;
    colaNueva = null;
    actualizarFondo(fondoNuevo); // junto con la cola, para no mezclar con la música propia que aún suena
    posicion = 0;
    if (!cola.length) { cancelarActual(); mostrar("espera"); } else mostrar("reproduccion");
  }

  async function bucleReproduccion() {
    const g = generacion;
    while (g === generacion) {
      if (colaNueva) aplicarCola();
      if (!cola.length) { await dormir(2000); continue; }
      if (pantallas.reproduccion.hidden) mostrar("reproduccion");
      const it = cola[posicion % cola.length];
      posicion = (posicion + 1) % cola.length;
      await reproducir(it);
    }
  }

  async function reproduccion(token) {
    let reproduciendo = false;
    for (;;) {
      try {
        await cargarContenido(token);
        $("sin-conexion").hidden = true;
      } catch (err) {
        if (err instanceof NoAutorizado) throw err; // revocada: vuelve a emparejarse
        $("sin-conexion").hidden = false;           // sin red: se sigue con lo que hay
      }
      if (!reproduciendo && (cola.length || colaNueva === null)) {
        reproduciendo = true;
        if (!cola.length) mostrar("espera");
        bucleReproduccion();
      }
      await dormir(REFRESCO_MS);
    }
  }

  // Evita que la pantalla se apague (si el navegador lo permite).
  async function mantenerEncendida() {
    try { await navigator.wakeLock?.request("screen"); } catch { /* opcional */ }
  }
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && mantenerEncendida());

  // ---------- Arranque ----------
  (async function main() {
    mantenerEncendida();
    for (;;) {
      let token = localStorage.getItem("tv_token");
      if (!token) token = await emparejar();
      try {
        await reproduccion(token);
      } catch (err) {
        if (!(err instanceof NoAutorizado)) throw err;
        localStorage.removeItem("tv_token");
        generacion++;
        cola = []; colaNueva = null; version = null; cancelarActual();
        fondo.enPausa = false; actualizarFondo([]);
      }
    }
  })();
}
