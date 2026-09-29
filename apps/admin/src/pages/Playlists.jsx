import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "../ui";

const NOMBRE_MAX = 150;
const TIPO = { imagen: "Imagen", video: "Video", musica: "Música" };

export default function Playlists() {
  const [lista, setLista] = useState([]);
  const [biblioteca, setBiblioteca] = useState([]); // multimedia activa disponible para agregar
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [elegido, setElegido] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError("");
      const [pl, mm] = await Promise.all([api("/tv/playlists"), api("/tv/multimedia")]);
      setLista(pl);
      setBiblioteca(mm.filter((m) => m.activo));
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = async (p) => {
    setErrorForm(""); setElegido("");
    if (!p) return setForm({ nombre: "", activo: true, items: [] });
    try { setForm(await api(`/tv/playlists/${p.id}`)); } catch (err) { setError(err.message); }
  };

  const agregar = () => {
    const m = biblioteca.find((x) => String(x.id) === elegido);
    if (!m) return;
    setForm({ ...form, items: [...form.items, { multimediaId: m.id, tipo: m.tipo, nombre: m.nombre, duracionOverride: null }] });
    setElegido("");
  };
  const mover = (i, d) => {
    const items = [...form.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    setForm({ ...form, items });
  };
  const quitar = (i) => setForm({ ...form, items: form.items.filter((_, k) => k !== i) });
  const duracion = (i, v) => setForm({ ...form, items: form.items.map((it, k) => (k === i ? { ...it, duracionOverride: v === "" ? null : Number(v) } : it)) });

  const guardar = async (e) => {
    e.preventDefault();
    setErrorForm("");
    if (!form.nombre.trim()) return setErrorForm("Escribe un nombre");
    const mala = form.items.find((it) => it.duracionOverride !== null && (!Number.isInteger(it.duracionOverride) || it.duracionOverride < 1 || it.duracionOverride > 3600));
    if (mala) return setErrorForm(`Duración inválida en "${mala.nombre}": entero entre 1 y 3600 segundos`);
    setGuardando(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        activo: form.activo,
        items: form.items.map((it) => ({ multimediaId: it.multimediaId, duracionOverride: it.duracionOverride })),
      };
      await api(form.id ? `/tv/playlists/${form.id}` : "/tv/playlists", { method: form.id ? "PUT" : "POST", body });
      setForm(null);
      cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section>
      <div className="bar">
        <h1>Playlists</h1>
        <button className="btn primary" onClick={() => abrir(null)}>+ Nueva playlist</button>
      </div>
      <p className="muted">Se reproducen en orden y en bucle. A cada pantalla se le asigna una en “Pantallas TV”. Si una playlist no incluye música, suena de fondo la música predeterminada (se marca en Multimedia).</p>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Elementos</th><th>Pantallas</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.items}</td>
                <td>{p.pantallas}</td>
                <td><span className={`badge ${p.activo ? "activo" : "inactivo"}`}>{p.activo ? "activa" : "inactiva"}</span></td>
                <td className="acts"><button className="btn sm" onClick={() => abrir(p)}>Editar</button></td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="5" className="muted">Sin playlists todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar playlist" : "Nueva playlist"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="form" noValidate>
            <label>Nombre
              <input value={form.nombre} maxLength={NOMBRE_MAX} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Recepción – mañana" />
            </label>
            <div className="pl-agregar">
              <select value={elegido} onChange={(e) => setElegido(e.target.value)}>
                <option value="">Agregar archivo…</option>
                {biblioteca.map((m) => <option key={m.id} value={m.id}>{TIPO[m.tipo]} · {m.nombre}</option>)}
              </select>
              <button type="button" className="btn" onClick={agregar} disabled={!elegido}>Agregar</button>
            </div>
            <div className="pl-items">
              {form.items.map((it, i) => (
                <div className="pl-item" key={`${it.multimediaId}-${i}`}>
                  <span className="muted">{i + 1}</span>
                  <span className="nombre" title={it.nombre}>{TIPO[it.tipo]} · {it.nombre}</span>
                  {it.tipo === "imagen"
                    ? <input type="number" min="1" max="3600" placeholder="10 s" title="Segundos en pantalla (vacío = 10)" value={it.duracionOverride ?? ""} onChange={(e) => duracion(i, e.target.value)} />
                    : <span className="muted">completo</span>}
                  <span>
                    <button type="button" className="btn sm" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                    <button type="button" className="btn sm" onClick={() => mover(i, 1)} disabled={i === form.items.length - 1} aria-label="Bajar">↓</button>
                    <button type="button" className="btn sm danger" onClick={() => quitar(i)} aria-label="Quitar">×</button>
                  </span>
                </div>
              ))}
              {!form.items.length && <span className="muted">La playlist está vacía.</span>}
            </div>
            <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Playlist activa</label>
            {errorForm && <p className="error">{errorForm}</p>}
            <button className="btn primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
