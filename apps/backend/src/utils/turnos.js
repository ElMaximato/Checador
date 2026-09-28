// Lógica de turnos (de día y de noche).
//
// Regla central: la `fecha` de una jornada es el día en que EMPIEZA el turno.
// Un turno 22:00–06:00 que empieza el lunes es la jornada del lunes aunque
// la salida se registre el martes a las 05:58.

const MIN_DIA = 1440;

// Un turno nocturno puede registrar entrada desde tantos minutos antes de empezar.
// Evita que, al cerrar el turno de la madrugada, el empleado vuelva a poder "entrar"
// a media mañana para el turno de esa misma noche.
const ANTICIPO_NOCTURNO_MIN = 180;

const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

// Fecha LOCAL en YYYY-MM-DD (no toISOString(): devuelve UTC).
function fechaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 1 = lunes ... 7 = domingo
const diaISO = (d) => (d.getDay() === 0 ? 7 : d.getDay());

const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function masDias(d, n) {
  const r = inicioDelDia(d);
  r.setDate(r.getDate() + n);
  return r;
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// Salida menor que entrada: el turno cruza la medianoche.
const esNocturno = (h) => aMinutos(h.hora_salida) < aMinutos(h.hora_entrada);

function duracionTurnoMin(h) {
  const d = aMinutos(h.hora_salida) - aMinutos(h.hora_entrada);
  return d > 0 ? d : d + MIN_DIA;
}

// Turno que empieza el día `dia` (Date): { fecha, inicio, fin }
function turnoDelDia(h, dia) {
  const base = inicioDelDia(dia);
  const inicio = new Date(base.getTime());
  inicio.setHours(0, aMinutos(h.hora_entrada), 0, 0);
  return { fecha: fechaISO(base), inicio, fin: new Date(inicio.getTime() + duracionTurnoMin(h) * 60_000) };
}

// A qué turno corresponde una entrada hecha en `ahora`.
// `dias` es un Set con los días de la semana del horario (1..7).
// Devuelve { turno } o { turno: null, error }.
function resolverTurnoEntrada(h, dias, ahora = new Date()) {
  const hoy = inicioDelDia(ahora);
  const ayer = masDias(ahora, -1);

  // Llegó después de la medianoche a un turno nocturno que empezó ayer.
  if (esNocturno(h) && dias.has(diaISO(ayer))) {
    const t = turnoDelDia(h, ayer);
    if (ahora < t.fin) return { turno: t };
  }

  if (!dias.has(diaISO(hoy))) return { turno: null, error: "El empleado no tiene horario asignado para hoy" };

  const t = turnoDelDia(h, hoy);
  if (esNocturno(h)) {
    const desde = new Date(t.inicio.getTime() - ANTICIPO_NOCTURNO_MIN * 60_000);
    if (ahora < desde) {
      return {
        turno: null,
        error: `Tu turno empieza a las ${hhmm(t.inicio)}; puedes registrar la entrada desde las ${hhmm(desde)}`,
      };
    }
  }
  return { turno: t };
}

// Puntualidad contra el inicio REAL del turno (no contra la hora del día).
function calcularPuntualidad(turno, toleranciaMin, ahora = new Date()) {
  const limite = turno.inicio.getTime() + toleranciaMin * 60_000;
  if (ahora.getTime() <= limite) return { puntualidad: "a_tiempo", minutosRetardo: 0 };
  return { puntualidad: "tarde", minutosRetardo: Math.round((ahora.getTime() - limite) / 60_000) };
}

// Desde cuándo el turno nocturno de HOY admite entrada (Date), o null si el horario no es nocturno.
function inicioVentanaEntrada(h, ahora = new Date()) {
  if (!esNocturno(h)) return null;
  return new Date(turnoDelDia(h, ahora).inicio.getTime() - ANTICIPO_NOCTURNO_MIN * 60_000);
}

module.exports = {
  ANTICIPO_NOCTURNO_MIN,
  fechaISO,
  diaISO,
  masDias,
  esNocturno,
  duracionTurnoMin,
  turnoDelDia,
  resolverTurnoEntrada,
  calcularPuntualidad,
  inicioVentanaEntrada,
};