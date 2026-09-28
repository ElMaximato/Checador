import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import "../dashboard.css";

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoy = () => fmt(new Date());

const PRESETS = [
  ["Últimos 7 días", () => { const d = new Date(); d.setDate(d.getDate() - 6); return [fmt(d), hoy()]; }],
  ["Este mes", () => { const d = new Date(); return [fmt(new Date(d.getFullYear(), d.getMonth(), 1)), hoy()]; }],
  ["Mes anterior", () => {
    const d = new Date();
    return [fmt(new Date(d.getFullYear(), d.getMonth() - 1, 1)), fmt(new Date(d.getFullYear(), d.getMonth(), 0))];
  }],
];

const pct = (v) => (v == null ? "—" : `${v}%`);

function Kpi({ titulo, valor, detalle, tono, destacado }) {
  return (
    <div className={`card kpi${destacado ? " destacado" : ""}`}>
      <strong className={tono}>{valor}</strong>
      <span className="etq">{titulo}</span>
      {detalle && <small>{detalle}</small>}
    </div>
  );
}

function Tarjeta({ titulo, extra, children }) {
  return (
    <div className="card tarjeta">
      <div className="tarjeta-titulo"><span>{titulo}</span>{extra}</div>
      <div className="tarjeta-cuerpo">{children}</div>
    </div>
  );
}

// ---------- Calendario: muestra el periodo y permite elegirlo ----------
const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const MAX_DIAS = 92; // mismo tope que el backend
const aDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const corta = (f) => aDate(f).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
const claveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function Calendario({ desde, hasta, porDia, alSeleccionar }) {
  const [vista, setVista] = useState(() => hasta.slice(0, 7)); // mes que se está viendo (YYYY-MM)
  const [ancla, setAncla] = useState(null); // primer clic, esperando el día final
  const [hover, setHover] = useState(null);
  const [aviso, setAviso] = useState("");
  const desdeCalendario = useRef(false);

  // Si el periodo cambia desde fuera (atajos o campos de fecha), el calendario se
  // va al mes final. Si lo cambió el propio calendario, se queda en el mes que ve.
  useEffect(() => {
    if (desdeCalendario.current) { desdeCalendario.current = false; return; }
    setVista(hasta.slice(0, 7));
    setAncla(null);
    setAviso("");
  }, [desde, hasta]);

  const [y, m] = vista.split("-").map(Number);
  const primero = new Date(y, m - 1, 1);
  const offset = (primero.getDay() + 6) % 7; // semana que empieza en lunes
  const ultimo = new Date(y, m, 0).getDate();
  const datos = new Map(porDia.map((d) => [d.fecha, d]));
  const hoyStr = hoy();
  const previa = ancla && hover ? (ancla <= hover ? [ancla, hover] : [hover, ancla]) : null;
  const nDias = Math.round((aDate(hasta) - aDate(desde)) / 86_400_000) + 1;
  const mes = primero.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const irMes = (delta) => setVista(claveMes(new Date(y, m - 1 + delta, 1)));

  // Primer clic = día inicial; segundo clic = día final (en cualquier orden).
  const elegir = (fecha) => {
    setAviso("");
    setHover(null);
    if (!ancla) { setAncla(fecha); return; }
    const [a, b] = ancla <= fecha ? [ancla, fecha] : [fecha, ancla];
    setAncla(null);
    const dias = Math.round((aDate(b) - aDate(a)) / 86_400_000) + 1;
    if (dias > MAX_DIAS) { setAviso(`El periodo no puede exceder ${MAX_DIAS} días (elegiste ${dias}).`); return; }
    if (a !== desde || b !== hasta) {
      desdeCalendario.current = true;
      alSeleccionar(a, b);
    }
  };

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(<span key={`v${i}`} />);
  for (let d = 1; d <= ultimo; d++) {
    const fecha = `${vista}-${String(d).padStart(2, "0")}`;
    const dia = datos.get(fecha); // solo existe para los días del periodo cargado
    const estado = !dia ? "" : dia.faltas ? "bad" : dia.tarde ? "warn" : dia.aTiempo ? "ok" : dia.pendientes ? "pend" : "";
    const clases = [
      "cal-dia",
      !ancla && fecha >= desde && fecha <= hasta && "rango",
      estado,
      previa && fecha >= previa[0] && fecha <= previa[1] && "previa",
      !ancla && fecha === desde && "inicio",
      !ancla && fecha === hasta && "fin",
      fecha === ancla && "ancla",
      fecha === hoyStr && "hoy",
    ].filter(Boolean).join(" ");
    const detalle = dia
      ? `${fecha}\nA tiempo: ${dia.aTiempo}\nRetardo: ${dia.tarde}\nFaltas: ${dia.faltas}${dia.pendientes ? `\nPendientes: ${dia.pendientes}` : ""}`
      : undefined;
    celdas.push(
      <button
        type="button"
        key={fecha}
        className={clases}
        title={detalle}
        disabled={fecha > hoyStr}
        onClick={() => elegir(fecha)}
        onMouseEnter={() => ancla && setHover(fecha)}
      >
        {d}
      </button>
    );
  }

  return (
    <>
      {ancla ? (
        <div className="cal-periodo activa">
          <span className="cal-periodo-etq">Elige el día final</span>
          <strong>Desde {corta(ancla)}</strong>
          <button type="button" className="cal-cancelar" onClick={() => { setAncla(null); setHover(null); }}>Cancelar</button>
        </div>
      ) : (
        <div className="cal-periodo">
          <span className="cal-periodo-etq">Periodo mostrado</span>
          <strong>{desde === hasta ? corta(desde) : `${corta(desde)} → ${corta(hasta)}`}</strong>
          <small>{nDias} {nDias === 1 ? "día" : "días"}</small>
        </div>
      )}

      <div className="cal-cab">
        <button onClick={() => irMes(-1)} aria-label="Mes anterior">‹</button>
        <span className="cal-mes">{mes.charAt(0).toUpperCase() + mes.slice(1)}</span>
        <button onClick={() => irMes(1)} disabled={vista >= claveMes(new Date())} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal-grid" onMouseLeave={() => setHover(null)}>
        {DOW.map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
        {celdas}
      </div>
      {aviso && <p className="error">{aviso}</p>}
      <div className="leyenda cal-pie">
        <span><i className="ok" />Todo a tiempo</span>
        <span><i className="warn" />Con retardos</span>
        <span><i className="bad" />Con faltas</span>
        <span><i className="pend" />Pendiente</span>
      </div>
      <p className="cal-ayuda">Haz clic en un día de inicio y luego en uno final para cambiar el periodo de las gráficas.</p>
    </>
  );
}

// ---------- Gráfica de áreas suavizadas (SVG, sin librerías) ----------
const W = 700, H = 240, M = { t: 12, r: 12, b: 26, l: 34 };
const f1 = (n) => n.toFixed(1);

function GraficaArea({ dias }) {
  if (dias.length < 2) return <p className="muted">Elige un rango de al menos 2 días para ver la tendencia.</p>;

  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const maximo = Math.max(1, ...dias.flatMap((d) => [d.aTiempo, d.tarde, d.faltas]));
  const tope = Math.ceil(maximo / 4) * 4; // 4 divisiones con números enteros
  const x = (i) => M.l + (i / (dias.length - 1)) * iw;
  const y = (v) => M.t + ih - (v / tope) * ih;

  const puntos = (clave) => dias.map((d, i) => [x(i), y(d[clave])]);
  // Curva suave entre puntos: tangentes horizontales, sin rebasar los valores.
  const curva = (pts) =>
    pts.reduce((acc, [px, py], i) => {
      if (i === 0) return `M${f1(px)},${f1(py)}`;
      const [qx, qy] = pts[i - 1];
      const mx = (qx + px) / 2;
      return `${acc} C${f1(mx)},${f1(qy)} ${f1(mx)},${f1(py)} ${f1(px)},${f1(py)}`;
    }, "");
  const area = (pts) => `${curva(pts)} L${f1(pts[pts.length - 1][0])},${f1(y(0))} L${f1(pts[0][0])},${f1(y(0))} Z`;

  const SERIES = [["aTiempo", "ok"], ["tarde", "warn"], ["faltas", "bad"]];
  const paso = Math.ceil(dias.length / 10);
  const etiqueta = (fecha) => (dias.length > 31 ? `${fecha.slice(8)}/${fecha.slice(5, 7)}` : fecha.slice(8));
  const ancho = iw / (dias.length - 1);

  return (
    <svg className="area" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tendencia diaria de asistencia">
      <defs>
        {SERIES.map(([, c]) => (
          <linearGradient key={c} id={`grad-${c}`} x1="0" y1="0" x2="0" y2="1">
            <stop className={`gs-${c}`} offset="0" stopOpacity=".55" />
            <stop className={`gs-${c}`} offset="1" stopOpacity=".03" />
          </linearGradient>
        ))}
      </defs>

      {[0, 1, 2, 3, 4].map((t) => (
        <g key={t}>
          <line className="rejilla" x1={M.l} x2={W - M.r} y1={y((tope * t) / 4)} y2={y((tope * t) / 4)} />
          <text className="eje" x={M.l - 8} y={y((tope * t) / 4) + 4} textAnchor="end">{(tope * t) / 4}</text>
        </g>
      ))}

      {SERIES.map(([clave, c]) => {
        const pts = puntos(clave);
        return (
          <g key={clave}>
            <path d={area(pts)} fill={`url(#grad-${c})`} />
            <path className={`linea ln-${c}`} d={curva(pts)} />
          </g>
        );
      })}

      {dias.map((d, i) => {
        const x0 = Math.max(M.l, x(i) - ancho / 2);
        const x1 = Math.min(W - M.r, x(i) + ancho / 2);
        return (
          <g key={d.fecha}>
            {i % paso === 0 && <text className="eje" x={x(i)} y={H - 8} textAnchor="middle">{etiqueta(d.fecha)}</text>}
            <rect className="hov" x={x0} y={M.t} width={x1 - x0} height={ih}>
              <title>{`${d.fecha}\nA tiempo: ${d.aTiempo}\nRetardo: ${d.tarde}\nFaltas: ${d.faltas}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Dona con segmentos ----------
function Dona({ partes, centro, etiqueta }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const total = partes.reduce((a, p) => a + p.valor, 0);
  let acum = 0;

  return (
    <div className="dona-wrap">
      <svg className="dona" viewBox="0 0 140 140" role="img" aria-label={`${etiqueta}: ${centro}`}>
        <g transform="rotate(-90 70 70)">
          <circle className="dona-fondo" cx="70" cy="70" r={R} />
          {total > 0 && partes.filter((p) => p.valor > 0).map((p) => {
            const largo = (p.valor / total) * C;
            const seg = (
              <circle
                key={p.nombre}
                className={`dona-seg ${p.clase}`}
                cx="70" cy="70" r={R}
                strokeDasharray={`${largo} ${C - largo}`}
                strokeDashoffset={-acum}
              />
            );
            acum += largo;
            return seg;
          })}
        </g>
        <text className="dona-num" x="70" y="74">{centro}</text>
        <text className="dona-etq" x="70" y="90">{etiqueta}</text>
      </svg>
      <div className="dona-leyenda">
        {partes.map((p) => (
          <div key={p.nombre}>
            <span className="leyenda"><span><i className={p.clase} />{p.nombre}</span></span>
            <strong>{p.valor}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Página ----------
export default function Dashboard() {
  const [desde, setDesde] = useState(() => PRESETS[1][1]()[0]);
  const [hasta, setHasta] = useState(hoy());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!desde || !hasta) return;
    let vigente = true; // evita que una respuesta vieja pise a una más nueva
    setError("");
    setCargando(true);
    api(`/dashboard?desde=${desde}&hasta=${hasta}`)
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [desde, hasta]);

  const aplicar = (fn) => {
    const [d, h] = fn();
    setDesde(d);
    setHasta(h);
  };

  const r = datos?.resumen;
  const hoyDia = datos?.porDia.find((d) => d.fecha === hoy());

  return (
    <section>
      <div className="bar">
        <h1>Dashboard</h1>
        <div className="filtros">
          <label>Desde<input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} /></label>
          <label>Hasta<input type="date" value={hasta} min={desde || undefined} max={hoy()} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
      </div>
      <div className="presets">
        {PRESETS.map(([nombre, fn]) => (
          <button key={nombre} className="btn sm" onClick={() => aplicar(fn)}>{nombre}</button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {!datos && cargando && <p className="muted">Cargando…</p>}

      {datos && (
        <div className={cargando ? "cargando" : ""}>
          <div className="dash-kpis">
            <Kpi destacado titulo="Asistencia" valor={pct(r.asistenciaPct)} detalle={`${r.esperados} días programados`} />
            <Kpi titulo="Puntualidad" valor={pct(r.puntualidadPct)} detalle={`${r.aTiempo} de ${r.jornadas} a tiempo`} tono="ok" />
            <Kpi
              titulo="Retardos"
              valor={r.tarde}
              detalle={r.retardoPromedioMin != null ? `${r.retardoPromedioMin} min en promedio` : "Sin retardos"}
              tono={r.tarde ? "warn" : undefined}
            />
            <Kpi titulo="Faltas" valor={r.faltas} detalle="Sin registro en día programado" tono={r.faltas ? "bad" : undefined} />
            <Kpi titulo="Sin salida" valor={r.sinSalida} detalle="Jornadas por revisar" tono={r.sinSalida ? "warn" : undefined} />
            {hoyDia && (
              <Kpi
                titulo="Hoy"
                valor={`${hoyDia.aTiempo + hoyDia.tarde} / ${hoyDia.aTiempo + hoyDia.tarde + hoyDia.pendientes}`}
                detalle="Han registrado entrada"
              />
            )}
          </div>

          <div className="fila-2">
            <Tarjeta titulo="Calendario">
              <Calendario
                desde={desde || datos.desde}
                hasta={hasta || datos.hasta}
                porDia={datos.porDia}
                alSeleccionar={(d, h) => { setDesde(d); setHasta(h); }}
              />
            </Tarjeta>
            <Tarjeta
              titulo="Tendencia diaria"
              extra={
                <span className="leyenda">
                  <span><i className="ok" />A tiempo</span>
                  <span><i className="warn" />Retardo</span>
                  <span><i className="bad" />Falta</span>
                </span>
              }
            >
              <GraficaArea dias={datos.porDia} />
            </Tarjeta>
          </div>

          <div className="fila-3">
            <Tarjeta titulo="Incidencias por empleado">
              {datos.incidencias.length ? (
                <ul className="lista">
                  {datos.incidencias.map((e) => (
                    <li key={e.codigo}>
                      <div>
                        <strong>{e.nombre}</strong>
                        <div className="muted">{e.codigo} · {e.departamento}</div>
                      </div>
                      <div className="chips">
                        {e.retardos > 0 && <span className="chip warn">{e.retardos} {e.retardos === 1 ? "retardo" : "retardos"}</span>}
                        {e.faltas > 0 && <span className="chip bad">{e.faltas} {e.faltas === 1 ? "falta" : "faltas"}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Sin retardos ni faltas en este rango.</p>
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Departamentos"
              extra={<span className="leyenda"><span><i className="grad" />Asistencia</span><span><i className="warn" />% retardo</span></span>}
            >
              {datos.porDepartamento.length ? (
                <div className="prog-lista">
                  {datos.porDepartamento.map((d) => (
                    <div key={d.departamento}>
                      <div className="prog-cab"><strong>{d.departamento}</strong><span>{pct(d.asistenciaPct)}</span></div>
                      <div className="prog"><i className="g" style={{ width: `${d.asistenciaPct ?? 0}%` }} /></div>
                      <div className="prog fina"><i className="w" style={{ width: `${d.retardoPct ?? 0}%` }} /></div>
                      <div className="prog-pie">
                        {d.empleados} {d.empleados === 1 ? "empleado" : "empleados"} · {d.tarde} {d.tarde === 1 ? "retardo" : "retardos"}
                        {d.retardoPromedioMin != null && ` (prom. ${d.retardoPromedioMin} min)`} · {d.faltas} {d.faltas === 1 ? "falta" : "faltas"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Sin empleados activos.</p>
              )}
            </Tarjeta>

            <Tarjeta titulo="Distribución">
              <Dona
                centro={pct(r.asistenciaPct)}
                etiqueta="Asistencia"
                partes={[
                  { nombre: "A tiempo", valor: r.aTiempo, clase: "ok" },
                  { nombre: "Retardo", valor: r.tarde, clase: "warn" },
                  { nombre: "Falta", valor: r.faltas, clase: "bad" },
                ]}
              />
            </Tarjeta>
          </div>

          <p className="muted">
            Solo incluye empleados activos. Una falta es un día programado sin registro; el día de hoy no cuenta como falta hasta que termine.
            Los días programados se calculan con el horario actual de cada empleado y desde su fecha de ingreso.
          </p>
        </div>
      )}
    </section>
  );
}