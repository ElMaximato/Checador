import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "../ui";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const NOMBRE_MAX = 80;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const vacio = { nombre: "", horaEntrada: "08:00", horaSalida: "18:00", toleranciaMinutos: 10, duracionJornadaHoras: 10, activo: true, dias: [1, 2, 3, 4, 5] };

const aMinutos = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const esEntero = (v, min, max) => {
  const n = String(v).trim() === "" ? NaN : Number(v);
  return Number.isInteger(n) && n >= min && n <= max;
};
const fmtHoras = (min) => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;

// Duración del turno en minutos, o null si las horas no son válidas o son iguales.
// Salida menor que entrada = turno nocturno: termina al día siguiente.
function duracionTurno(f) {
  if (!HORA_RE.test(f.horaEntrada) || !HORA_RE.test(f.horaSalida)) return null;
  const dif = aMinutos(f.horaSalida) - aMinutos(f.horaEntrada);
  if (dif === 0) return null;
  return dif > 0 ? dif : dif + 1440;
}

// Mismas reglas que el backend (leerHorario en admin.controller.js).
function validar(f, lista) {
  const e = {};
  const nombre = f.nombre.trim();
  if (!nombre) e.nombre = "Escribe un nombre";
  else if (nombre.length > NOMBRE_MAX) e.nombre = `Máximo ${NOMBRE_MAX} caracteres`;
  else if (lista.some((h) => h.id !== f.id && h.nombre.trim().toLowerCase() === nombre.toLowerCase())) e.nombre = "Ya existe un horario con ese nombre";

  if (!HORA_RE.test(f.horaEntrada)) e.horaEntrada = "Elige la hora de entrada";
  if (!HORA_RE.test(f.horaSalida)) e.horaSalida = "Elige la hora de salida";
  const turno = duracionTurno(f);
  if (HORA_RE.test(f.horaEntrada) && HORA_RE.test(f.horaSalida) && turno === null) {
    e.horaSalida = "No puede ser igual a la hora de entrada";
  }

  if (!esEntero(f.toleranciaMinutos, 0, 120)) e.toleranciaMinutos = "Entero entre 0 y 120";
  if (!esEntero(f.duracionJornadaHoras, 1, 24)) e.duracionJornadaHoras = "Entero entre 1 y 24";
  else if (turno !== null && Number(f.duracionJornadaHoras) < Math.ceil(turno / 60)) {
    e.duracionJornadaHoras = `Debe cubrir el turno (mínimo ${Math.ceil(turno / 60)} h)`;
  }

  if (!f.dias.length) e.dias = "Elige al menos un día";
  return e;
}

export default function Horarios() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [intento, setIntento] = useState(false); // ya se intentó guardar: mostrar errores por campo
  const [errorForm, setErrorForm] = useState(""); // error devuelto por el servidor
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try { setError(""); setLista(await api("/horarios")); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (h) => {
    setIntento(false);
    setErrorForm("");
    setForm({ ...h, dias: [...h.dias] });
  };

  const errores = form ? validar(form, lista) : {};
  const ver = intento ? errores : {}; // errores visibles
  const turno = form ? duracionTurno(form) : null;
  const nocturno = turno !== null && aMinutos(form.horaSalida) < aMinutos(form.horaEntrada);

  const guardar = async (e) => {
    e.preventDefault();
    setIntento(true);
    setErrorForm("");
    if (Object.keys(errores).length) return;
    setGuardando(true);
    try {
      const { id, ...resto } = form;
      const body = {
        ...resto,
        nombre: form.nombre.trim(),
        toleranciaMinutos: Number(form.toleranciaMinutos),
        duracionJornadaHoras: Number(form.duracionJornadaHoras),
      };
      await api(id ? `/horarios/${id}` : "/horarios", { method: id ? "PUT" : "POST", body });
      setForm(null);
      cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const dia = (n) => setForm({ ...form, dias: form.dias.includes(n) ? form.dias.filter((d) => d !== n) : [...form.dias, n] });
  const cls = (k) => (ver[k] ? "invalido" : undefined);

  return (
    <section>
      <div className="bar">
        <h1>Horarios</h1>
        <button className="btn primary" onClick={() => abrir({ ...vacio })}>+ Nuevo horario</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Horario</th><th>Tolerancia</th><th>Vigencia de jornada</th><th>Días</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((h) => (
              <tr key={h.id}>
                <td>{h.nombre}</td>
                <td>{h.horaEntrada} – {h.horaSalida}{h.horaSalida < h.horaEntrada && <span className="muted"> · nocturno</span>}</td>
                <td>{h.toleranciaMinutos} min</td>
                <td>{h.duracionJornadaHoras} h</td>
                <td>{DIAS.filter((_, i) => h.dias.includes(i + 1)).join(" ")}</td>
                <td><span className={`badge ${h.activo ? "activo" : "baja"}`}>{h.activo ? "activo" : "inactivo"}</span></td>
                <td><button className="btn sm" onClick={() => abrir(h)}>Editar</button></td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="7" className="muted">Sin horarios todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar horario" : "Nuevo horario"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="form" noValidate>
            <label>Nombre
              <input className={cls("nombre")} value={form.nombre} maxLength={NOMBRE_MAX} onChange={set("nombre")} placeholder="Ej. Turno matutino" />
              {ver.nombre && <span className="campo-error">{ver.nombre}</span>}
              <span className="counter">{form.nombre.length}/{NOMBRE_MAX}</span>
            </label>
            <div className="row2">
              <label>Entrada
                <input className={cls("horaEntrada")} type="time" value={form.horaEntrada} onChange={set("horaEntrada")} />
                {ver.horaEntrada && <span className="campo-error">{ver.horaEntrada}</span>}
              </label>
              <label>Salida
                <input className={cls("horaSalida")} type="time" value={form.horaSalida} onChange={set("horaSalida")} />
                {ver.horaSalida && <span className="campo-error">{ver.horaSalida}</span>}
              </label>
            </div>
            {turno !== null && <span className="muted">Duración del turno: {fmtHoras(turno)}{nocturno ? " · termina al día siguiente" : ""}</span>}
            <div className="row2">
              <label>Tolerancia (min)
                <input className={cls("toleranciaMinutos")} type="number" min="0" max="120" step="1" value={form.toleranciaMinutos} onChange={set("toleranciaMinutos")} />
                {ver.toleranciaMinutos && <span className="campo-error">{ver.toleranciaMinutos}</span>}
              </label>
              <label>Vigencia de jornada (h)
                <input className={cls("duracionJornadaHoras")} type="number" min="1" max="24" step="1" value={form.duracionJornadaHoras} onChange={set("duracionJornadaHoras")} />
                {ver.duracionJornadaHoras && <span className="campo-error">{ver.duracionJornadaHoras}</span>}
              </label>
            </div>
            <div>
              <div className="dias">
                {DIAS.map((d, i) => (
                  <button type="button" key={d} className={form.dias.includes(i + 1) ? "dia on" : "dia"} onClick={() => dia(i + 1)}>{d}</button>
                ))}
              </div>
              {ver.dias && <span className="campo-error">{ver.dias}</span>}
            </div>
            <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Horario activo</label>
            {errorForm && <p className="error">{errorForm}</p>}
            <button className="btn primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}