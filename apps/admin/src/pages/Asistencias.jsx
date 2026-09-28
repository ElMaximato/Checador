import { useEffect, useState } from "react";
import { api, foto } from "../api";
import { Modal } from "../ui";

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ESTADO = { activa: "En curso", cerrada: "Cerrada", expirada_sin_salida: "Sin salida" };
const LIMITES = [25, 50, 100, 200];

function validarRango(desde, hasta) {
  if (!desde || !hasta) return "Elige la fecha inicial y la final";
  if (desde > hasta) return "La fecha inicial no puede ser posterior a la final";
  return "";
}

export default function Asistencias() {
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(50);
  const [datos, setDatos] = useState({ filas: [], total: 0, paginas: 1 });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [ver, setVer] = useState(null); // { titulo, url }

  const errorRango = validarRango(desde, hasta);

  useEffect(() => {
    if (errorRango) return;
    let vigente = true; // evita que una respuesta vieja pise a una más reciente
    setCargando(true);
    setError("");
    api(`/asistencias?desde=${desde}&hasta=${hasta}&pagina=${pagina}&limite=${limite}`)
      .then((r) => {
        if (!vigente) return;
        setDatos(r);
        if (r.pagina !== pagina) setPagina(r.pagina); // el servidor acotó la página
      })
      .catch((e) => {
        if (!vigente) return;
        setDatos({ filas: [], total: 0, paginas: 1 });
        setError(e.message);
      })
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [desde, hasta, pagina, limite, errorRango]);

  // Cualquier cambio de filtro regresa a la primera página.
  const cambiarDesde = (v) => { setDesde(v); setPagina(1); };
  const cambiarHasta = (v) => { setHasta(v); setPagina(1); };
  const cambiarLimite = (v) => { setLimite(Number(v)); setPagina(1); };

  const { total, paginas } = datos;
  const filas = errorRango ? [] : datos.filas;
  const inicio = total ? (pagina - 1) * limite + 1 : 0;
  const fin = Math.min(pagina * limite, total);

  const thumb = (ruta, titulo) =>
    ruta ? <img className="thumb" src={foto(ruta)} alt={titulo} onClick={() => setVer({ titulo, url: foto(ruta) })} /> : <span className="muted">—</span>;

  return (
    <section>
      <div className="bar">
        <h1>Asistencias</h1>
        <div className="filtros">
          <label>Desde<input className={errorRango ? "invalido" : undefined} type="date" value={desde} max={hasta || hoy()} onChange={(e) => cambiarDesde(e.target.value)} /></label>
          <label>Hasta<input className={errorRango ? "invalido" : undefined} type="date" value={hasta} min={desde || undefined} max={hoy()} onChange={(e) => cambiarHasta(e.target.value)} /></label>
        </div>
      </div>
      {errorRango && <p className="error">{errorRango}</p>}
      {error && <p className="error">{error}</p>}
      <div className={`card scroll${cargando ? " cargando" : ""}`}>
        <table>
          <thead><tr><th>Fecha</th><th>Empleado</th><th>Entrada</th><th>Salida</th><th>Puntualidad</th><th>Jornada</th><th>Foto entrada</th><th>Foto salida</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>{f.fecha}</td>
                <td>{f.nombre}<div className="muted">{f.codigo}</div></td>
                <td>{f.horaEntrada}</td>
                <td>{f.horaSalida || "—"}{f.salidaDiaSiguiente && <span className="muted"> (+1 día)</span>}</td>
                <td><span className={`badge ${f.puntualidad === "a_tiempo" ? "activo" : "tarde"}`}>{f.puntualidad === "a_tiempo" ? "A tiempo" : `Retardo ${f.minutosRetardo} min`}</span></td>
                <td>{ESTADO[f.estado]}</td>
                <td>{thumb(f.fotoEntrada, `Entrada · ${f.nombre}`)}</td>
                <td>{thumb(f.fotoSalida, `Salida · ${f.nombre}`)}</td>
              </tr>
            ))}
            {!filas.length && !error && !errorRango && !cargando && <tr><td colSpan="8" className="muted">Sin registros en este rango.</td></tr>}
          </tbody>
        </table>
      </div>

      {!errorRango && total > 0 && (
        <div className="paginador">
          <span className="muted">Mostrando {inicio}–{fin} de {total}</span>
          <div className="paginador-ctl">
            <label>Por página
              <select value={limite} onChange={(e) => cambiarLimite(e.target.value)}>
                {LIMITES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className="btn sm" disabled={pagina <= 1 || cargando} onClick={() => setPagina(pagina - 1)}>‹ Anterior</button>
            <span className="muted">Página {pagina} de {paginas}</span>
            <button className="btn sm" disabled={pagina >= paginas || cargando} onClick={() => setPagina(pagina + 1)}>Siguiente ›</button>
          </div>
        </div>
      )}

      {ver && (
        <Modal titulo={ver.titulo} onClose={() => setVer(null)}>
          <img className="grande" src={ver.url} alt={ver.titulo} />
        </Modal>
      )}
    </section>
  );
}