import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { BottomNav } from "../components/BottomNav";
import { colors } from "../theme/colors";
import { obtenerHistorial, obtenerJornadaHoy, obtenerPerfil, type JornadaHoy, type Perfil } from "../api/client";
import { formatearMinutos, mesActual, porcentaje } from "../utils/format";
import type { GoFn } from "../navigation/types";

function saludo(hora: number) {
  if (hora < 12) return "Buenos días,";
  if (hora < 19) return "Buenas tardes,";
  return "Buenas noches,";
}

type EstadoHome = "cargando" | "error" | "entrada" | "salida" | "completada" | "expirada";

// [texto pequeño del botón, texto principal del botón, texto de la píldora]
const TEXTOS: Record<EstadoHome, [string, string, string]> = {
  cargando: ["CONSULTANDO", "Cargando…", "Consultando…"],
  error: ["SIN CONEXIÓN", "No disponible", "Sin conexión"],
  entrada: ["REGISTRO DISPONIBLE", "Registrar entrada", "Sin registrar hoy"],
  salida: ["REGISTRO DISPONIBLE", "Registrar salida", "Jornada activa"],
  completada: ["HASTA MAÑANA", "Jornada completada", "Jornada cerrada"],
  expirada: ["CONTACTA A RH", "Sin salida registrada", "Jornada expirada"],
};

export function HomeScreen({ go }: { go: GoFn }) {
  const [now, setNow] = useState(new Date());
  const [jornada, setJornada] = useState<JornadaHoy>(null);
  const [cargadoEn, setCargadoEn] = useState(Date.now());
  const [cargando, setCargando] = useState(true);
  const [errorConexion, setErrorConexion] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [asistenciaPct, setAsistenciaPct] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const cargar = useCallback(() => {
    setCargando(true);
    setErrorConexion(false);
    obtenerJornadaHoy()
      .then((j) => {
        setJornada(j);
        setCargadoEn(Date.now());
      })
      .catch(() => {
        // Sin respuesta del servidor NO se puede asumir "sin registro":
        // se bloquea el botón y se ofrece reintentar.
        setJornada(null);
        setErrorConexion(true);
      })
      .finally(() => setCargando(false));

    // Nombre, turno y asistencia del mes: datos reales del backend.
    obtenerPerfil().then(setPerfil).catch(() => {});
    obtenerHistorial(mesActual())
      .then((h) => setAsistenciaPct(h.resumen.asistenciaPct))
      .catch(() => {});
  }, []);

  // Home se desmonta y se vuelve a montar cada vez que se navega de
  // regreso a ella (la navegación de App.tsx es por estado), así que
  // este efecto refresca todo automáticamente cada vez.
  useEffect(() => {
    cargar();
  }, [cargar]);

  const estado: EstadoHome = cargando
    ? "cargando"
    : errorConexion
      ? "error"
      : !jornada
        ? "entrada"
        : jornada.estado === "activa"
          ? "salida"
          : jornada.estado === "cerrada"
            ? "completada"
            : "expirada";
  const puedeRegistrar = estado === "entrada" || estado === "salida";
  const alerta = estado === "error" || estado === "expirada";
  const [textoChico, textoGrande, textoPildora] = TEXTOS[estado];

  // Tiempo trabajado hoy: el backend da el valor al consultar y, si la
  // jornada sigue activa, se le suma el tiempo transcurrido desde entonces.
  const minutosHoy =
    jornada?.minutosTrabajados == null
      ? null
      : jornada.estado === "activa"
        ? jornada.minutosTrabajados + Math.max(0, Math.floor((now.getTime() - cargadoEn) / 60_000))
        : jornada.minutosTrabajados;

  const date = now.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = now.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.greeting}>{saludo(now.getHours())}</Text>
            <Text style={styles.heading}>{perfil ? perfil.nombre.split(" ")[0] : " "}</Text>
          </View>
        </View>

        <View style={styles.timeHero}>
          <View style={[styles.statusPill, alerta && { backgroundColor: colors.warningBg }]}>
            <View style={[styles.statusDot, alerta && { backgroundColor: colors.warning }]} />
            <Text style={[styles.statusPillText, alerta && { color: colors.warning }]}>{textoPildora}</Text>
          </View>
          <Text style={styles.heroTime}>{time}</Text>
          <Text style={styles.heroDate}>{date}</Text>
        </View>

        {errorConexion && (
          <Pressable style={styles.retryBanner} onPress={cargar}>
            <Text style={styles.retryText}>No se pudo conectar con el servidor. Toca para reintentar.</Text>
          </Pressable>
        )}

        <View style={styles.shiftCard}>
          <View style={styles.shiftCardHeader}>
            <View>
              <Text style={styles.cardLabel}>TU JORNADA DE HOY</Text>
              <Text style={styles.shiftTitle}>{perfil?.horario.nombre ?? " "}</Text>
            </View>
            <View style={styles.scheduleBadge}>
              <Text style={styles.scheduleBadgeText}>
                {perfil ? `${perfil.horario.horaEntrada} – ${perfil.horario.horaSalida}` : "— —"}
              </Text>
            </View>
          </View>

          <View style={styles.shiftLine}>
            <View style={jornada ? styles.doneDot : styles.pendingDot}>
              {jornada && <Icon name="check" size={14} color={colors.success} />}
            </View>
            <View>
              <Text style={styles.shiftLineLabel}>Entrada</Text>
              <Text style={styles.shiftLineValue}>{jornada?.horaEntrada ?? "— —"}</Text>
            </View>
            <View style={styles.dashLine} />
            <View style={jornada?.horaSalida ? styles.doneDot : styles.pendingDot}>
              {jornada?.horaSalida && <Icon name="check" size={14} color={colors.success} />}
            </View>
            <View>
              <Text style={styles.shiftLineLabel}>Salida</Text>
              <Text style={styles.shiftLineValue}>{jornada?.horaSalida ?? "— —"}</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.primaryAction, !puedeRegistrar && { opacity: 0.5 }]}
          disabled={!puedeRegistrar}
          onPress={() => go("fingerprint", { tipo: estado === "salida" ? "salida" : "entrada" })}
        >
          <View style={styles.actionIcon}>
            <Icon name="fingerprint" size={29} color={colors.white} />
          </View>
          <View>
            <Text style={styles.actionSmall}>{textoChico}</Text>
            <Text style={styles.actionStrong}>{textoGrande}</Text>
          </View>
          <Icon name="chevron" size={22} color={colors.white} />
        </Pressable>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: "#e8f3ee" }]}>
              <Icon name="clock" size={18} color="#24745b" />
            </View>
            <View>
              <Text style={styles.summaryStrong}>{formatearMinutos(minutosHoy)}</Text>
              <Text style={styles.summarySmall}>Tiempo trabajado</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.infoBlueBg }]}>
              <Icon name="calendar" size={18} color={colors.infoBlue} />
            </View>
            <View>
              <Text style={styles.summaryStrong}>{porcentaje(asistenciaPct)}</Text>
              <Text style={styles.summarySmall}>Asistencia mensual</Text>
            </View>
          </View>
        </View>
      </View>
      <BottomNav go={go} screen="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 90 },
  topHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 14, color: colors.textMuted },
  heading: { fontSize: 24, fontWeight: "700", color: "#11213b", letterSpacing: -0.5 },
  timeHero: { alignItems: "center", paddingVertical: 25 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    backgroundColor: colors.successBg,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.successStrong },
  statusPillText: { fontSize: 11, fontWeight: "700", color: "#39745d" },
  heroTime: { marginTop: 11, fontSize: 53, fontWeight: "700", color: "#10203a", letterSpacing: -2.5 },
  heroDate: { marginTop: 8, fontSize: 14, color: "#6e7a8b", textTransform: "capitalize" },
  retryBanner: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.warningBg,
  },
  retryText: { fontSize: 11, fontWeight: "600", color: colors.warning, textAlign: "center" },
  shiftCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    backgroundColor: colors.white,
    padding: 18,
  },
  shiftCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#919ba6" },
  shiftTitle: { marginTop: 3, fontSize: 14, fontWeight: "700", color: "#243148" },
  scheduleBadge: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, backgroundColor: "#f1f5f6" },
  scheduleBadgeText: { fontSize: 10, fontWeight: "600", color: "#536273" },
  shiftLine: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  doneDot: {
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dff2e9",
  },
  pendingDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: "#d6dee4" },
  dashLine: { flex: 1, height: 1, borderTopWidth: 1, borderColor: "#d6dfe5", borderStyle: "dashed" },
  shiftLineLabel: { fontSize: 9, color: "#929ca8" },
  shiftLineValue: { fontSize: 13, fontWeight: "700", color: "#26354a" },
  primaryAction: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  actionSmall: { fontSize: 8, letterSpacing: 1, color: "#a8d5d4", marginBottom: 2 },
  actionStrong: { fontSize: 16, fontWeight: "700", color: colors.white, flexGrow: 1 },
  summaryRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e7ebef",
    backgroundColor: colors.white,
    borderRadius: 15,
  },
  summaryIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  summaryStrong: { fontSize: 11, fontWeight: "700", color: "#2c394c" },
  summarySmall: { fontSize: 8, color: "#96a0ab", marginTop: 1 },
});
