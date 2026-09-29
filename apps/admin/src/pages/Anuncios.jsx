import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "../ui";

const TITULO_MAX = 200;
const CONTENIDO_MAX = 2000;

// <input type="datetime-local"> trabaja en hora local, formato "YYYY-MM-DDTHH:mm".
const aInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const nuevo = () => {
  const ahora = new Date();
  return { titulo: "", contenido: "", fechaInicio: aInput(ahora), fechaFin: aInput(new Date(ahora.getTime() + 7 * 864e5)), activo: true };
};
const fmt = (v) => v.replace("T", " ");

// Mismas reglas que el backend (leerAnuncio en tvAdmin.controller.js).
function validar(f) {
  const e = {};
  if (!f.titulo.trim()) e.titulo = "Escribe un título";
  if (!f.contenido.trim()) e.contenido = "Escribe el mensaje";
  if (!f.fechaInicio) e.fechaInicio = "Elige cuándo empieza";
  if (!f.fechaFin) e.fechaFin = "Elige cuándo termina";
  else if (f.fechaInicio && f.fechaFin <= f.fechaInicio) e.fechaFin = "Debe ser posterior al inicio";
  return e;
}

export default function Anuncios() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [intento, setIntento] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try { setError(""); setLista(await api("/tv/anuncios")); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (a) => { setIntento(false); setErrorForm(""); setForm({ ...a }); };
  const errores = form ? validar(form) : {};
  const ver = intento ? errores : {};
  const cls = (k) => (ver[k] ? "invalido" : undefined);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setIntento(true);
    setErrorForm("");
    if (Object.keys(errores).length) return;
    setGuardando(true);
    try {
      const { id, estado, creadoPor, ...resto } = form;
      await api(id ? `/tv/anuncios/${id}` : "/tv/anuncios", {
        method: id ? "PUT" : "POST",
        body: { ...resto, titulo: form.titulo.trim(), contenido: form.contenido.trim() },
      });
      setForm(null);
      cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (a) => {
    if (!confirm(`¿Eliminar el anuncio "${a.titulo}"?`)) return;
    try { await api(`/tv/anuncios/${a.id}`, { method: "DELETE" }); cargar(); } catch (err) { setError(err.message); }
  };

  return (
    <section>
      <div className="bar">
        <h1>Anuncios</h1>
        <button className="btn primary" onClick={() => abrir(nuevo())}>+ Nuevo anuncio</button>
      </div>
      <p className="muted">Se muestran en todas las pantallas, intercalados con la playlist, mientras estén vigentes.</p>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Título</th><th>Vigencia</th><th>Estado</th><th>Creado por</th><th></th></tr></thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id}>
                <td>{a.titulo}</td>
                <td>{fmt(a.fechaInicio)} → {fmt(a.fechaFin)}</td>
                <td><span className={`badge ${a.estado}`}>{a.estado}</span></td>
                <td>{a.creadoPor}</td>
                <td className="acts">
                  <button className="btn sm" onClick={() => abrir(a)}>Editar</button>
                  <button className="btn sm danger" onClick={() => eliminar(a)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="5" className="muted">Sin anuncios todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar anuncio" : "Nuevo anuncio"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="form" noValidate>
            <label>Título
              <input className={cls("titulo")} value={form.titulo} maxLength={TITULO_MAX} onChange={set("titulo")} placeholder="Ej. Junta general" />
              {ver.titulo && <span className="campo-error">{ver.titulo}</span>}
            </label>
            <label>Mensaje
              <textarea className={cls("contenido")} value={form.contenido} maxLength={CONTENIDO_MAX} onChange={set("contenido")} />
              {ver.contenido && <span className="campo-error">{ver.contenido}</span>}
              <span className="counter">{form.contenido.length}/{CONTENIDO_MAX}</span>
            </label>
            <div className="row2">
              <label>Empieza
                <input className={cls("fechaInicio")} type="datetime-local" value={form.fechaInicio} onChange={set("fechaInicio")} />
                {ver.fechaInicio && <span className="campo-error">{ver.fechaInicio}</span>}
              </label>
              <label>Termina
                <input className={cls("fechaFin")} type="datetime-local" value={form.fechaFin} onChange={set("fechaFin")} />
                {ver.fechaFin && <span className="campo-error">{ver.fechaFin}</span>}
              </label>
            </div>
            <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Anuncio activo</label>
            {errorForm && <p className="error">{errorForm}</p>}
            <button className="btn primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
