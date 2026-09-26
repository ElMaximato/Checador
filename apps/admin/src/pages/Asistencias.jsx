import { useEffect, useState } from "react";
import { api, foto } from "../api";
import { Modal } from "../ui";

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ESTADO = { activa: "En curso", cerrada: "Cerrada", expirada_sin_salida: "Sin salida" };

export default function Asistencias() {
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [ver, setVer] = useState(null); // { titulo, url }

  useEffect(() => {
    setError("");
    api(`/asistencias?desde=${desde}&hasta=${hasta}`).then(setFilas).catch((e) => setError(e.message));
  }, [desde, hasta]);

  const thumb = (ruta, titulo) =>
    ruta ? <img className="thumb" src={foto(ruta)} alt={titulo} onClick={() => setVer({ titulo, url: foto(ruta) })} /> : <span className="muted">—</span>;

  return (
    <section>
      <div className="bar">
        <h1>Asistencias</h1>
        <div className="filtros">
          <label>Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label>Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Empleado</th><th>Entrada</th><th>Salida</th><th>Puntualidad</th><th>Jornada</th><th>Foto entrada</th><th>Foto salida</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>{f.fecha}</td>
                <td>{f.nombre}<div className="muted">{f.codigo}</div></td>
                <td>{f.horaEntrada}</td>
                <td>{f.horaSalida || "—"}</td>
                <td><span className={`badge ${f.puntualidad === "a_tiempo" ? "activo" : "tarde"}`}>{f.puntualidad === "a_tiempo" ? "A tiempo" : `Retardo ${f.minutosRetardo} min`}</span></td>
                <td>{ESTADO[f.estado]}</td>
                <td>{thumb(f.fotoEntrada, `Entrada · ${f.nombre}`)}</td>
                <td>{thumb(f.fotoSalida, `Salida · ${f.nombre}`)}</td>
              </tr>
            ))}
            {!filas.length && !error && <tr><td colSpan="8" className="muted">Sin registros en este rango.</td></tr>}
          </tbody>
        </table>
      </div>
      {ver && (
        <Modal titulo={ver.titulo} onClose={() => setVer(null)}>
          <img className="grande" src={ver.url} alt={ver.titulo} />
        </Modal>
      )}
    </section>
  );
}
