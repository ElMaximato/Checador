import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { BottomNav } from "../components/BottomNav";
import { colors } from "../theme/colors";
import { obtenerJornadaHoy, type JornadaHoy } from "../api/client";
import type { GoFn } from "../navigation/types";

// TODO backend: nombre y resumen mensual aún vienen de mock; la
// jornada de hoy (entrada/salida real) ya se consulta a la API.
export function HomeScreen({ go }: { go: GoFn }) {
  const [now, setNow] = useState(new Date());
  const [jornada, setJornada] = useState<JornadaHoy>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const cargarJornada = useCallback(() => {
    setCargando(true);
    obtenerJornadaHoy()
      .then(setJornada)
      .catch(() => setJornada(null))
      .finally(() => setCargando(false));
  }, []);

  // Home se desmonta y se vuelve a montar cada vez que se navega de
  // regreso a ella (la navegación de App.tsx es por estado), así que
  // este efecto refresca la jornada automáticamente cada vez.
  useEffect(() => {
    cargarJornada();
  }, [cargarJornada]);

  const siguienteTipo: "entrada" | "salida" =
    !jornada || jornada.estado !== "activa" ? "entrada" : "salida";
  const puedeRegistrar = !cargando && (!jornada || jornada.estado === "activa");

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
            <Text style={styles.greeting}>Buenos días,</Text>
            <Text style={styles.heading}>Mariana</Text>
          </View>
          <Pressable style={styles.iconButton}>
            <Icon name="bell" size={20} color="#3e4a5c" />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={styles.timeHero}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>
              {jornada?.estado === "activa" ? "Jornada activa" : jornada ? "Jornada cerrada" : "Sin registrar hoy"}
            </Text>
          </View>
          <Text style={styles.heroTime}>{time}</Text>
          <Text style={styles.heroDate}>{date}</Text>
          <View style={styles.officeRow}>
            <Icon name="map" size={16} color="#26767a" />
            <Text style={styles.officeText}>Oficina Central · Monterrey</Text>
          </View>
        </View>

        <View style={styles.shiftCard}>
          <View style={styles.shiftCardHeader}>
            <View>
              <Text style={styles.cardLabel}>TU JORNADA DE HOY</Text>
              <Text style={styles.shiftTitle}>Turno administrativo</Text>
            </View>
            <View style={styles.scheduleBadge}>
              <Text style={styles.scheduleBadgeText}>09:00 – 18:00</Text>
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
          onPress={() => go("fingerprint", { tipo: siguienteTipo })}
        >
          <View style={styles.actionIcon}>
            <Icon name="fingerprint" size={29} color={colors.white} />
          </View>
          <View>
            <Text style={styles.actionSmall}>
              {jornada?.estado === "expirada_sin_salida" ? "JORNADA EXPIRADA" : "REGISTRO DISPONIBLE"}
            </Text>
            <Text style={styles.actionStrong}>
              {siguienteTipo === "entrada" ? "Registrar entrada" : "Registrar salida"}
            </Text>
          </View>
          <Icon name="chevron" size={22} color={colors.white} />
        </Pressable>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: "#e8f3ee" }]}>
              <Icon name="clock" size={18} color="#24745b" />
            </View>
            <View>
              <Text style={styles.summaryStrong}>7 h 32 min</Text>
              <Text style={styles.summarySmall}>Tiempo trabajado</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.infoBlueBg }]}>
              <Icon name="calendar" size={18} color={colors.infoBlue} />
            </View>
            <View>
              <Text style={styles.summaryStrong}>100%</Text>
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
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8ed",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e26351",
  },
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
  officeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  officeText: { fontSize: 11, color: "#8a95a2" },
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
