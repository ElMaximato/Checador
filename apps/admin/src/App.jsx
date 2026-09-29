import { useEffect, useState } from "react";
import { api, getToken, setAlCerrarSesion } from "./api";
import { Icono } from "./icons";
import Dashboard from "./pages/Dashboard";
import Empleados from "./pages/Empleados";
import Horarios from "./pages/Horarios";
import Asistencias from "./pages/Asistencias";
import Administradores from "./pages/Administradores";
import Anuncios from "./pages/Anuncios";
import Multimedia from "./pages/Multimedia";
import Playlists from "./pages/Playlists";
import PantallasTv from "./pages/PantallasTv";
import "./layout.css";
import "./animaciones.css";
import "./tv.css";

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
      // Solo para decidir qué pestañas mostrar; el backend valida el rol de verdad.
      localStorage.setItem("admin_rol", r.admin.rol);
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

const TABS_BASE = [
  ["dashboard", "Dashboard", "inicio"],
  ["empleados", "Empleados", "usuarios"],
  ["horarios", "Horarios", "reloj"],
  ["asistencias", "Asistencias", "calendario"],
  ["anuncios", "Anuncios TV", "anuncio"],
  ["multimedia", "Multimedia", "multimedia"],
  ["playlists", "Playlists", "playlist"],
  ["pantallas", "Pantallas TV", "tv"],
];
const NOMBRE_ROL = { super_admin: "Super administrador", rh: "Recursos Humanos", supervisor: "Supervisor" };


const TABS_VALIDAS = ["dashboard", "empleados", "horarios", "asistencias", "anuncios", "multimedia", "playlists", "pantallas", "administradores"];
const tabDesdeHash = () => {
  const k = window.location.hash.replace(/^#\/?/, "");
  return TABS_VALIDAS.includes(k) ? k : "dashboard";
};

export default function App() {
  const [sesion, setSesion] = useState(!!getToken());
  const [tab, setTab] = useState(tabDesdeHash);
  const [menu, setMenu] = useState(false); // barra lateral abierta (solo en pantallas chicas)

  // Al cerrar sesión se vuelve a la primera pestaña, para que otro usuario
  // que entre después no caiga en una pantalla que su rol no puede ver.
  const cerrarSesion = () => {
    setSesion(false);
    setMenu(false);
  };

  useEffect(() => setAlCerrarSesion(cerrarSesion), []);

  useEffect(() => {
    const alCambiar = () => setTab(tabDesdeHash());
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  // Cierre manual: se limpia la URL para que el siguiente usuario empiece en el dashboard.
  const salir = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_rol");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setTab("dashboard");
    cerrarSesion();
  };


  if (!sesion) return <Login onOk={() => setSesion(true)} />;

  const rol = localStorage.getItem("admin_rol");
  const tabs = rol === "super_admin" ? [...TABS_BASE, ["administradores", "Administradores", "escudo"]] : TABS_BASE;
  const tabActiva = tabs.some(([k]) => k === tab) ? tab : "dashboard";
  const ir = (k) => {
    window.location.hash = `/${k}`; // dispara hashchange y eso actualiza `tab`
    setMenu(false);
  };
  const fecha = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="shell">
      <div className="brand"><span>Checa</span>dor</div>

      <header className="topbar">
        <button className="menu-btn" onClick={() => setMenu(true)} aria-label="Abrir menú"><Icono nombre="menu" tam={24} /></button>
        <span className="brand-mini"><span>Checa</span>dor</span>
        <span className="espacio" />
        <span className="muted fecha">{fecha}</span>
        <span className="titulo">Panel administrativo</span>
      </header>

      <div className={menu ? "scrim abierto" : "scrim"} onClick={() => setMenu(false)} />
      <aside className={menu ? "sidebar abierto" : "sidebar"}>
        <div className="sb-user">
          <span className="sb-avatar"><Icono nombre="usuario" tam={22} /></span>
          <div>
            <strong>{localStorage.getItem("admin_nombre")}</strong>
            <small>{NOMBRE_ROL[rol] || ""}</small>
          </div>
        </div>
        <nav>
          {tabs.map(([k, nombre, icono]) => (
            <button key={k} className={tabActiva === k ? "nav-item on" : "nav-item"} onClick={() => ir(k)}>
              <Icono nombre={icono} />
              {nombre}
            </button>
          ))}
        </nav>
        <div className="sb-pie">
          <button className="nav-item" onClick={salir}>
            <Icono nombre="salir" />
            Cerrar sesión
          </button>
        </div>
      </aside>

     <main>
        <div className="pagina" key={tabActiva}>
          {tabActiva === "dashboard" && <Dashboard />}
          {tabActiva === "empleados" && <Empleados />}
          {tabActiva === "horarios" && <Horarios />}
          {tabActiva === "asistencias" && <Asistencias />}
          {tabActiva === "anuncios" && <Anuncios />}
          {tabActiva === "multimedia" && <Multimedia />}
          {tabActiva === "playlists" && <Playlists />}
          {tabActiva === "pantallas" && <PantallasTv />}
          {tabActiva === "administradores" && <Administradores />}
        </div>
      </main>
    </div>
  );
}