import { useCallback, useEffect, useState } from "react";
import { api, apiSubir, foto } from "../api";
import { Modal } from "../ui";

const NOMBRE_MAX = 200;
const TIPO = { imagen: "Imagen", video: "Video", musica: "Música" };
const esAudio = (f) => !!f && f.type.startsWith("audio/");
const tam = (b) => (b === null ? "—" : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Miniatura({ m }) {
  if (m.tipo === "imagen") return <img className="miniatura" src={foto(m.url)} alt="" loading="lazy" />;
  return <span className="miniatura">{m.tipo === "video" ? "VIDEO" : "AUDIO"}</span>;
}

export default function Multimedia() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [subir, setSubir] = useState(null); // { archivo, nombre, predeterminada }
  const [editar, setEditar] = useState(null);
  const [errorForm, setErrorForm] = useState("");
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    try { setError(""); setLista(await api("/tv/multimedia")); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async (e) => {
    e.preventDefault();
    setErrorForm("");
    if (!subir.archivo) return setErrorForm("Elige un archivo");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("nombre", subir.nombre.trim());
      if (esAudio(subir.archivo) && subir.predeterminada) fd.append("predeterminada", "true");
      fd.append("archivo", subir.archivo);
      await apiSubir("/tv/multimedia", fd);
      setSubir(null);
      cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setBusy(false);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    setErrorForm("");
    if (!editar.nombre.trim()) return setErrorForm("Escribe un nombre");
    setBusy(true);
    try {
      await api(`/tv/multimedia/${editar.id}`, {
        method: "PUT",
        body: { nombre: editar.nombre.trim(), activo: editar.activo, predeterminada: editar.tipo === "musica" && editar.predeterminada },
      });
      setEditar(null);
      cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (m) => {
    if (!confirm(`¿Eliminar "${m.nombre}"? El archivo se borra del servidor.`)) return;
    try { await api(`/tv/multimedia/${m.id}`, { method: "DELETE" }); cargar(); } catch (err) { setError(err.message); }
  };

  return (
    <section>
      <div className="bar">
        <h1>Multimedia</h1>
        <button className="btn primary" onClick={() => { setErrorForm(""); setSubir({ archivo: null, nombre: "", predeterminada: false }); }}>+ Subir archivo</button>
      </div>
      <p className="muted">Imágenes, videos y música que luego se arman en playlists.</p>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th></th><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>En playlists</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id}>
                <td><Miniatura m={m} /></td>
                <td>{m.nombre}{m.predeterminada && <> <span className="badge vigente">predeterminada</span></>}</td>
                <td>{TIPO[m.tipo]}</td>
                <td>{tam(m.tamanoBytes)}</td>
                <td>{m.usos}</td>
                <td><span className={`badge ${m.activo ? "activo" : "inactivo"}`}>{m.activo ? "activo" : "inactivo"}</span></td>
                <td className="acts">
                  <button className="btn sm" onClick={() => { setErrorForm(""); setEditar({ ...m }); }}>Editar</button>
                  <button className="btn sm danger" onClick={() => eliminar(m)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="7" className="muted">Sin archivos todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {subir && (
        <Modal titulo="Subir archivo" onClose={() => !busy && setSubir(null)}>
          <form onSubmit={enviar} className="form">
            <label>Archivo
              <input type="file" accept="image/*,video/*,audio/*" onChange={(e) => setSubir({ ...subir, archivo: e.target.files[0] || null })} />
            </label>
            <label>Nombre (opcional)
              <input value={subir.nombre} maxLength={NOMBRE_MAX} onChange={(e) => setSubir({ ...subir, nombre: e.target.value })} placeholder="Si lo dejas vacío se usa el nombre del archivo" />
            </label>
            {esAudio(subir.archivo) && (
              <label className="check"><input type="checkbox" checked={subir.predeterminada} onChange={(e) => setSubir({ ...subir, predeterminada: e.target.checked })} /> Música predeterminada (suena de fondo si la playlist no trae música)</label>
            )}
            {errorForm && <p className="error">{errorForm}</p>}
            <button className="btn primary" disabled={busy}>{busy ? "Subiendo…" : "Subir"}</button>
          </form>
        </Modal>
      )}

      {editar && (
        <Modal titulo="Editar archivo" onClose={() => setEditar(null)}>
          <form onSubmit={guardar} className="form">
            <label>Nombre
              <input value={editar.nombre} maxLength={NOMBRE_MAX} onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} />
            </label>
            <label className="check"><input type="checkbox" checked={editar.activo} onChange={(e) => setEditar({ ...editar, activo: e.target.checked })} /> Archivo activo (si se desactiva, las TV lo omiten)</label>
            {editar.tipo === "musica" && (
              <label className="check"><input type="checkbox" checked={editar.predeterminada} onChange={(e) => setEditar({ ...editar, predeterminada: e.target.checked })} /> Música predeterminada (suena de fondo si la playlist no trae música)</label>
            )}
            {errorForm && <p className="error">{errorForm}</p>}
            <button className="btn primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
