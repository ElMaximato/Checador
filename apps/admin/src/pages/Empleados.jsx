import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "../ui";

const vacio = { nombre: "", puesto: "", departamento: "", horarioId: "", fechaIngreso: "" };
const NOMBRE_MAX = 80;
const ANIO = new Date().getFullYear();
const FECHA_MIN = `${ANIO}-01-01`;
const FECHA_MAX = `${ANIO}-12-31`;

export default function Empleados() {
  const [lista, setLista] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [opciones, setOpciones] = useState({ puestos: [], departamentos: [] });
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | campos (con id si edita)
  // Puesto y departamento son listas cerradas; estas dos banderas activan
  // el campo de texto para dar de alta una opción que aún no existe.
  const [puestoNuevo, setPuestoNuevo] = useState(false);
  const [depNuevo, setDepNuevo] = useState(false);
  const [pin, setPin] = useState(null); // { nombre, codigo, pin }
  const [disp, setDisp] = useState(null); // { empleado, lista }

  const cargar = useCallback(async () => {
    try {
      setError("");
      const [e, h, o] = await Promise.all([api("/empleados"), api("/horarios"), api("/empleados/opciones")]);
      setLista(e);
      setHorarios(h);
      setOpciones(o);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn) => {
    try { await fn(); await cargar(); } catch (err) { alert(err.message); }
  };

  const guardar = (e) => {
    e.preventDefault();
    accion(async () => {
      const { id, ...body } = form;
      await api(id ? `/empleados/${id}` : "/empleados", { method: id ? "PUT" : "POST", body });
      setForm(null);
    });
  };

  const abrirNuevo = () => {
    setPuestoNuevo(false);
    setDepNuevo(false);
    setForm({ ...vacio, horarioId: horarios[0]?.id || "" });
  };

  const editar = (e) => {
    // Si el empleado ya tenía un puesto o departamento que ya no está en
    // la lista (dato viejo), se abre directo en modo "nuevo" para no
    // perder el valor.
    setPuestoNuevo(!opciones.puestos.includes(e.puesto));
    setDepNuevo(!opciones.departamentos.includes(e.departamento));
    setForm({ id: e.id, nombre: e.nombre, puesto: e.puesto, departamento: e.departamento, horarioId: e.horario_id, fechaIngreso: e.fecha_ingreso || "" });
  };

  const estado = (e, nuevo) => {
    if (nuevo === "baja" && !confirm(`¿Dar de baja a ${e.nombre}? Se revocarán sus teléfonos.`)) return;
    accion(() => api(`/empleados/${e.id}/estado`, { method: "PATCH", body: { estado: nuevo } }));
  };

  const generarPin = (e) =>
    accion(async () => setPin({ nombre: e.nombre, ...(await api(`/empleados/${e.id}/pin`, { method: "POST" })) }));

  const verDispositivos = async (e) => {
    try { setDisp({ empleado: e, lista: await api(`/empleados/${e.id}/dispositivos`) }); } catch (err) { alert(err.message); }
  };

  const revocar = async (d) => {
    if (!confirm("¿Revocar este teléfono? Deberá activarse de nuevo con un PIN.")) return;
    try {
      await api(`/dispositivos/${d.id}/revocar`, { method: "POST" });
      setDisp({ ...disp, lista: await api(`/empleados/${disp.empleado.id}/dispositivos`) });
      cargar();
    } catch (err) { alert(err.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section>
      <div className="bar">
        <h1>Empleados</h1>
        <button className="btn primary" onClick={abrirNuevo}>+ Nuevo empleado</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>ID</th><th>Nombre</th><th>Puesto</th><th>Departamento</th><th>Horario</th><th>Estado</th><th>Teléfonos</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td>{e.codigo}</td>
                <td>{e.nombre}</td>
                <td>{e.puesto}</td>
                <td>{e.departamento}</td>
                <td>{e.horario}</td>
                <td><span className={`badge ${e.estado}`}>{e.estado}</span></td>
                <td>{e.dispositivos_activos}</td>
                <td className="acts">
                  <button className="btn sm" onClick={() => editar(e)}>Editar</button>
                  {e.estado === "activo" && <button className="btn sm" onClick={() => generarPin(e)}>PIN</button>}
                  <button className="btn sm" onClick={() => verDispositivos(e)}>Teléfonos</button>
                  {e.estado === "activo"
                    ? <button className="btn sm danger" onClick={() => estado(e, "baja")}>Baja</button>
                    : <button className="btn sm" onClick={() => estado(e, "activo")}>Reactivar</button>}
                </td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="8" className="muted">Sin empleados todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar empleado" : "Nuevo empleado"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="form">
            <label>
              Nombre
              <input value={form.nombre} maxLength={NOMBRE_MAX} onChange={set("nombre")} required />
              <span className="counter">{form.nombre.length}/{NOMBRE_MAX}</span>
            </label>

            <label>Puesto
              <select
                value={puestoNuevo ? "__nuevo__" : form.puesto}
                onChange={(e) => {
                  if (e.target.value === "__nuevo__") { setPuestoNuevo(true); setForm({ ...form, puesto: "" }); }
                  else { setPuestoNuevo(false); setForm({ ...form, puesto: e.target.value }); }
                }}
                required={!puestoNuevo}
              >
                <option value="" disabled>Elige un puesto</option>
                {opciones.puestos.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="__nuevo__">+ Agregar puesto nuevo…</option>
              </select>
            </label>
            {puestoNuevo && (
              <label>Nuevo puesto
                <input value={form.puesto} maxLength={NOMBRE_MAX} onChange={set("puesto")} placeholder="Ej. Analista de nómina" required autoFocus />
              </label>
            )}

            <label>Departamento
              <select
                value={depNuevo ? "__nuevo__" : form.departamento}
                onChange={(e) => {
                  if (e.target.value === "__nuevo__") { setDepNuevo(true); setForm({ ...form, departamento: "" }); }
                  else { setDepNuevo(false); setForm({ ...form, departamento: e.target.value }); }
                }}
                required={!depNuevo}
              >
                <option value="" disabled>Elige un departamento</option>
                {opciones.departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
                <option value="__nuevo__">+ Agregar departamento nuevo…</option>
              </select>
            </label>
            {depNuevo && (
              <label>Nuevo departamento
                <input value={form.departamento} maxLength={NOMBRE_MAX} onChange={set("departamento")} placeholder="Ej. Recursos Humanos" required autoFocus />
              </label>
            )}

            <label>Horario
              <select value={form.horarioId} onChange={set("horarioId")} required>
                <option value="" disabled>Elige un horario</option>
                {horarios.map((h) => <option key={h.id} value={h.id}>{h.nombre} ({h.horaEntrada}–{h.horaSalida}){h.activo ? "" : " · inactivo"}</option>)}
              </select>
            </label>
            <label>Fecha de ingreso
              <input type="date" min={FECHA_MIN} max={FECHA_MAX} value={form.fechaIngreso} onChange={set("fechaIngreso")} />
            </label>
            <button className="btn primary">Guardar</button>
          </form>
        </Modal>
      )}

      {pin && (
        <Modal titulo="PIN de activación" onClose={() => setPin(null)}>
          <p>Entrega estos datos a <strong>{pin.nombre}</strong>. El PIN se muestra una sola vez.</p>
          <div className="pin"><span>ID</span><strong>{pin.codigo}</strong><span>PIN</span><strong>{pin.pin}</strong></div>
        </Modal>
      )}

      {disp && (
        <Modal titulo={`Teléfonos de ${disp.empleado.nombre}`} onClose={() => setDisp(null)}>
          <table>
            <thead><tr><th>#</th><th>Dispositivo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {disp.lista.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.info || "—"}<div className="muted">{d.fechaActivacion || ""}</div></td>
                  <td>{d.activo ? "Activo" : d.pinUsado ? "Revocado" : "PIN pendiente"}</td>
                  <td>{d.activo && <button className="btn sm danger" onClick={() => revocar(d)}>Revocar</button>}</td>
                </tr>
              ))}
              {!disp.lista.length && <tr><td colSpan="4" className="muted">Sin teléfonos vinculados.</td></tr>}
            </tbody>
          </table>
        </Modal>
      )}
    </section>
  );
}
