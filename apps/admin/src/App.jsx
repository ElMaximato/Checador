import { useEffect, useState } from "react";
import { api, getToken, setAlCerrarSesion } from "./api";
import Empleados from "./pages/Empleados";
import Horarios from "./pages/Horarios";
import Asistencias from "./pages/Asistencias";

function Login({ onOk }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/login", { method: "POST", body: { email, password } });
      localStorage.setItem("admin_token", r.token);
      localStorage.setItem("admin_nombre", r.admin.nombre);
      onOk();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={enviar}>
        <h1>Checador</h1>
        <p className="muted">Panel administrativo</p>
        <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}

const TABS = [["empleados", "Empleados"], ["horarios", "Horarios"], ["asistencias", "Asistencias"]];

export default function App() {
  const [sesion, setSesion] = useState(!!getToken());
  const [tab, setTab] = useState("empleados");

  useEffect(() => setAlCerrarSesion(() => setSesion(false)), []);

  const salir = () => {
    localStorage.removeItem("admin_token");
    setSesion(false);
  };

  if (!sesion) return <Login onOk={() => setSesion(true)} />;

  return (
    <div className="app">
      <header className="top">
        <strong>Checador</strong>
        <nav>
          {TABS.map(([k, n]) => (
            <button key={k} className={tab === k ? "tab on" : "tab"} onClick={() => setTab(k)}>{n}</button>
          ))}
        </nav>
        <span className="muted">{localStorage.getItem("admin_nombre")}</span>
        <button className="btn" onClick={salir}>Salir</button>
      </header>
      <main>
        {tab === "empleados" && <Empleados />}
        {tab === "horarios" && <Horarios />}
        {tab === "asistencias" && <Asistencias />}
      </main>
    </div>
  );
}
