import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "../ui";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const vacio = { nombre: "", horaEntrada: "08:00", horaSalida: "18:00", toleranciaMinutos: 10, duracionJornadaHoras: 10, activo: true, dias: [1, 2, 3, 4, 5] };

export default function Horarios() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  const cargar = useCallback(async () => {
    try { setError(""); setLista(await api("/horarios")); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const { id, ...body } = form;
      await api(id ? `/horarios/${id}` : "/horarios", { method: id ? "PUT" : "POST", body });
      setForm(null);
      cargar();
    } catch (err) { alert(err.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const dia = (n) => setForm({ ...form, dias: form.dias.includes(n) ? form.dias.filter((d) => d !== n) : [...form.dias, n] });

  return (
    <section>
      <div className="bar">
        <h1>Horarios</h1>
        <button className="btn primary" onClick={() => setForm(vacio)}>+ Nuevo horario</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Horario</th><th>Tolerancia</th><th>Vigencia de jornada</th><th>Días</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((h) => (
              <tr key={h.id}>
                <td>{h.nombre}</td>
                <td>{h.horaEntrada} – {h.horaSalida}</td>
                <td>{h.toleranciaMinutos} min</td>
                <td>{h.duracionJornadaHoras} h</td>
                <td>{DIAS.filter((_, i) => h.dias.includes(i + 1)).join(" ")}</td>
                <td><span className={`badge ${h.activo ? "activo" : "baja"}`}>{h.activo ? "activo" : "inactivo"}</span></td>
                <td><button className="btn sm" onClick={() => setForm(h)}>Editar</button></td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="7" className="muted">Sin horarios todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar horario" : "Nuevo horario"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="form">
            <label>Nombre<input value={form.nombre} onChange={set("nombre")} required /></label>
            <div className="row2">
              <label>Entrada<input type="time" value={form.horaEntrada} onChange={set("horaEntrada")} required /></label>
              <label>Salida<input type="time" value={form.horaSalida} onChange={set("horaSalida")} required /></label>
            </div>
            <div className="row2">
              <label>Tolerancia (min)<input type="number" min="0" value={form.toleranciaMinutos} onChange={set("toleranciaMinutos")} required /></label>
              <label>Vigencia de jornada (h)<input type="number" min="1" value={form.duracionJornadaHoras} onChange={set("duracionJornadaHoras")} required /></label>
            </div>
            <div className="dias">
              {DIAS.map((d, i) => (
                <button type="button" key={d} className={form.dias.includes(i + 1) ? "dia on" : "dia"} onClick={() => dia(i + 1)}>{d}</button>
              ))}
            </div>
            <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Horario activo</label>
            <button className="btn primary">Guardar</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
