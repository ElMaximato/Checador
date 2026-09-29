import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "../ui";

const NOMBRE_MAX = 100;
const UBICACION_MAX = 150;
const vacio = { codigo: "", nombre: "", ubicacion: "", playlistId: "" };

export default function PantallasTv() {
  const [lista, setLista] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // con id = editar; sin id = emparejar
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError("");
      const [tv, pl] = await Promise.all([api("/tv/pantallas"), api("/tv/playlists")]);
      setLista(tv);
      setPlaylists(pl);
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000); // refresca el "en línea"
    return () => clearInterval(t);
  }, [cargar]);

  const abrir = (f) => { setErrorForm(""); setForm(f); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setErrorForm("");
    if (!form.id && !form.codigo.trim()) return setErrorForm("Escribe el código que aparece en la TV");
    if (!form.nombre.trim()) return setErrorForm("Escribe un nombre para la pantalla");
    setGuardando(true);
    try {
      const body = { nombre: form.nombre.trim(), ubicacion: form.ubicacion.trim(), playlistId: form.playlistId === "" ? null : Number(form.playlistId) };
      if (form.id) await api(`/tv/pantallas/${form.id}`, { method: "PUT", body });
      else await api("/tv/pantallas/emparejar", { method: "POST", body: { ...body, codigo: form.codigo } });
      setForm(null);
      cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const revocar = async (t) => {
    if (!confirm(`¿Revocar "${t.nombre}"? La pantalla dejará de reproducir y tendrá que emparejarse de nuevo.`)) return;
    try { await api(`/tv/pantallas/${t.id}/revocar`, { method: "POST" }); cargar(); } catch (err) { setError(err.message); }
  };

  return (
    <section>
      <div className="bar">
        <h1>Pantallas TV</h1>
        <button className="btn primary" onClick={() => abrir({ ...vacio })}>+ Emparejar TV</button>
      </div>
      <p className="muted">Abre la app de TV en la pantalla, verás un código de 6 caracteres; captúralo aquí.</p>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Pantalla</th><th>Ubicación</th><th>Playlist</th><th>Conexión</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id}>
                <td>{t.nombre}</td>
                <td>{t.ubicacion || "—"}</td>
                <td>{t.playlistNombre || <span className="muted">sin playlist</span>}</td>
                <td>{t.estado === "emparejado" ? <><span className={t.enLinea ? "punto on" : "punto"} />{t.enLinea ? "en línea" : "sin señal"}</> : "—"}</td>
                <td><span className={`badge ${t.estado}`}>{t.estado}</span></td>
                <td className="acts">
                  {t.estado === "emparejado" && (
                    <>
                      <button className="btn sm" onClick={() => abrir({ id: t.id, nombre: t.nombre, ubicacion: t.ubicacion || "", playlistId: t.playlistId ?? "" })}>Editar</button>
                      <button className="btn sm danger" onClick={() => revocar(t)}>Revocar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="6" className="muted">Sin pantallas emparejadas todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar pantalla" : "Emparejar TV"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="form" noValidate>
            {!form.id && (
              <label>Código de la TV
                <input className="codigo-tv" value={form.codigo} maxLength={8} onChange={set("codigo")} placeholder="ABC123" autoFocus />
              </label>
            )}
            <label>Nombre
              <input value={form.nombre} maxLength={NOMBRE_MAX} onChange={set("nombre")} placeholder="Ej. TV Recepción" />
            </label>
            <label>Ubicación (opcional)
              <input value={form.ubicacion} maxLength={UBICACION_MAX} onChange={set("ubicacion")} placeholder="Ej. Planta baja, junto a la entrada" />
            </label>
            <label>Playlist
              <select value={form.playlistId} onChange={set("playlistId")}>
                <option value="">Sin playlist (solo anuncios)</option>
                {playlists.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? "" : " (inactiva)"}</option>)}
              </select>
            </label>
            {errorForm && <p className="error">{errorForm}</p>}
            <button className="btn primary" disabled={guardando}>{guardando ? "Guardando…" : form.id ? "Guardar" : "Emparejar"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
