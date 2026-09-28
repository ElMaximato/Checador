import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "../ui";

const ROLES = [
  ["super_admin", "Super administrador"],
  ["rh", "Recursos Humanos"],
  ["supervisor", "Supervisor"],
];
const NOMBRE_MAX = 80;
const vacio = { nombre: "", email: "", rol: "rh", password: "", passwordActual: "" };

export default function Administradores() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | campos (con id si edita)
  const [confirmar, setConfirmar] = useState(null); // null | { admin, activo, passwordActual }

  const cargar = useCallback(async () => {
    try {
      setError("");
      setLista(await api("/administradores"));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const { id, esYo, ...body } = form;
      await api(id ? `/administradores/${id}` : "/administradores", { method: id ? "PUT" : "POST", body });
      setForm(null);
      cargar();
    } catch (err) {
      alert(err.message);
      setForm((f) => f && { ...f, passwordActual: "" });
    }
  };

  const enviarEstado = async (e) => {
    e.preventDefault();
    try {
      await api(`/administradores/${confirmar.admin.id}/estado`, {
        method: "PATCH",
        body: { activo: confirmar.activo, passwordActual: confirmar.passwordActual },
      });
      setConfirmar(null);
      cargar();
    } catch (err) {
      alert(err.message);
      setConfirmar((c) => c && { ...c, passwordActual: "" });
    }
  };

  const editar = (a) => setForm({ id: a.id, nombre: a.nombre, email: a.email, rol: a.rol, password: "", passwordActual: "", esYo: a.esYo });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const nombreRol = (r) => ROLES.find(([k]) => k === r)?.[1] || r;

  return (
    <section>
      <div className="bar">
        <h1>Administradores</h1>
        <button className="btn primary" onClick={() => setForm(vacio)}>+ Nuevo administrador</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id}>
                <td>{a.nombre}{a.esYo && <span className="muted"> (tú)</span>}</td>
                <td>{a.email}</td>
                <td>{nombreRol(a.rol)}</td>
                <td><span className={`badge ${a.activo ? "activo" : "baja"}`}>{a.activo ? "activo" : "inactivo"}</span></td>
                <td className="acts">
                  <button className="btn sm" onClick={() => editar(a)}>Editar</button>
                  {!a.esYo && (a.activo
                    ? <button className="btn sm danger" onClick={() => setConfirmar({ admin: a, activo: false, passwordActual: "" })}>Desactivar</button>
                    : <button className="btn sm" onClick={() => setConfirmar({ admin: a, activo: true, passwordActual: "" })}>Activar</button>)}
                </td>
              </tr>
            ))}
            {!lista.length && !error && <tr><td colSpan="5" className="muted">Sin administradores.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? "Editar administrador" : "Nuevo administrador"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="form">
            <label>
              Nombre
              <input value={form.nombre} maxLength={NOMBRE_MAX} onChange={set("nombre")} required />
              <span className="counter">{form.nombre.length}/{NOMBRE_MAX}</span>
            </label>
            <label>Correo<input type="email" value={form.email} onChange={set("email")} required /></label>
            <label>Rol
              <select value={form.rol} onChange={set("rol")} disabled={form.esYo}>
                {ROLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            {form.esYo && <p className="muted">No puedes cambiar tu propio rol.</p>}
            <label>{form.id ? "Nueva contraseña (opcional)" : "Contraseña"}
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                minLength={8}
                maxLength={72}
                required={!form.id}
                placeholder={form.id ? "Déjala vacía para no cambiarla" : "Mínimo 8 caracteres"}
                autoComplete="new-password"
              />
            </label>
            <label>Tu contraseña (para confirmar)
              <input
                type="password"
                value={form.passwordActual}
                onChange={set("passwordActual")}
                required
                placeholder="La contraseña con la que iniciaste sesión"
                autoComplete="current-password"
              />
            </label>
            <button className="btn primary">Guardar</button>
          </form>
        </Modal>
      )}

      {confirmar && (
        <Modal
          titulo={confirmar.activo ? "Activar administrador" : "Desactivar administrador"}
          onClose={() => setConfirmar(null)}
        >
          <form onSubmit={enviarEstado} className="form">
            <p>
              {confirmar.activo
                ? <>¿Activar a <strong>{confirmar.admin.nombre}</strong>? Podrá volver a entrar al panel.</>
                : <>¿Desactivar a <strong>{confirmar.admin.nombre}</strong>? Ya no podrá entrar al panel.</>}
            </p>
            <label>Tu contraseña (para confirmar)
              <input
                type="password"
                value={confirmar.passwordActual}
                onChange={(e) => setConfirmar({ ...confirmar, passwordActual: e.target.value })}
                required
                autoFocus
                autoComplete="current-password"
              />
            </label>
            <button className={confirmar.activo ? "btn primary" : "btn danger"}>
              {confirmar.activo ? "Activar" : "Desactivar"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}