import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/BottomNav";
import { colors } from "../theme/colors";
import { obtenerHistorial, type Historial } from "../api/client";
import { MESES, formatearMinutos, mesActual, porcentaje } from "../utils/format";
import type { GoFn } from "../navigation/types";

// Suma o resta meses a un "YYYY-MM".
function moverMes(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function etiquetaMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function HistoryScreen({ go }: { go: GoFn }) {
  const [mes, setMes] = useState(mesActual());
  const [data, setData] = useState<Historial | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    obtenerHistorial(mes)
      .then((h) => !cancelado && setData(h))
      .catch((e) => !cancelado && setError(e?.message ?? "No se pudo cargar el historial"))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [mes, intento]);

  const esMesActual = mes === mesActual();
  const resumen = data?.resumen;
  const registros = data?.registros ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MI ACTIVIDAD</Text>
            <Text style={styles.title}>Historial</Text>
          </View>
        </View>

        <View style={styles.monthSelector}>
          <Pressable hitSlop={12} onPress={() => setMes(moverMes(mes, -1))}>
            <Text style={styles.monthArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{etiquetaMes(mes)}</Text>
          <Pressable hitSlop={12} disabled={esMesActual} onPress={() => setMes(moverMes(mes, 1))}>
            <Text style={[styles.monthArrow, esMesActual && { opacity: 0.25 }]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.monthStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{resumen ? resumen.diasLaborados : "—"}</Text>
            <Text style={styles.statLabel}>Días laborados</Text>
          </View>
          <View style={[styles.statItem, styles.statItemBorder]}>
            <Text style={styles.statValue}>
              {resumen ? `${(resumen.minutosTotales / 60).toFixed(1)} h` : "—"}
            </Text>
            <Text style={styles.statLabel}>Horas totales</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{porcentaje(resumen?.puntualidadPct)}</Text>
            <Text style={styles.statLabel}>Puntualidad</Text>
          </View>
        </View>

        <View style={styles.recordsHeading}>
          <Text style={styles.recordsHeadingStrong}>Registros del mes</Text>
          <Text style={styles.recordsHeadingLight}>
            {registros.length} {registros.length === 1 ? "registro" : "registros"}
          </Text>
        </View>

        {cargando ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : error ? (
          <View style={{ alignItems: "center", marginTop: 30, gap: 12 }}>
            <Text style={[styles.message, { marginTop: 0 }]}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => setIntento(intento + 1)}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : registros.length === 0 ? (
          <Text style={styles.message}>Sin registros en {etiquetaMes(mes)}.</Text>
        ) : (
          <FlatList
            data={registros}
            keyExtractor={(item) => item.fecha}
            contentContainerStyle={{ gap: 8, paddingBottom: 90 }}
            renderItem={({ item }) => {
              const bien = item.puntualidad === "a_tiempo";
              const total =
                item.minutosTotales != null
                  ? formatearMinutos(item.minutosTotales)
                  : item.estado === "activa"
                    ? "En curso"
                    : "Sin salida";
              return (
                <View style={styles.recordCard}>
                  <View style={styles.recordDate}>
                    <Text style={styles.recordDay}>{item.dia}</Text>
                    <Text style={styles.recordDow}>{item.diaSemana}</Text>
                  </View>
                  <View style={styles.recordInfo}>
                    <View>
                      <Text style={styles.recordInfoLabel}>Entrada</Text>
                      <Text style={styles.recordInfoValue}>{item.horaEntrada}</Text>
                    </View>
                    <View>
                      <Text style={styles.recordInfoLabel}>Salida</Text>
                      <Text style={styles.recordInfoValue}>{item.horaSalida ?? "— —"}</Text>
                    </View>
                    <View>
                      <Text style={styles.recordInfoLabel}>Total</Text>
                      <Text style={styles.recordInfoValue}>{total}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, bien ? styles.statusGood : styles.statusLate]}>
                    <Text style={[styles.statusBadgeText, bien ? styles.statusGoodText : styles.statusLateText]}>
                      {bien ? "A tiempo" : "Retardo"}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
      <BottomNav go={go} screen="history" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1.3, color: "#277277" },
  title: { fontSize: 24, fontWeight: "700", color: "#11213b", letterSpacing: -0.5 },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#edf0f2",
  },
  message: { marginTop: 30, textAlign: "center", fontSize: 12, color: "#7f8a98" },
  retry: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontSize: 12, fontWeight: "700", color: colors.white },
  monthArrow: { fontSize: 25, color: "#7d8995" },
  monthLabel: { fontSize: 13, fontWeight: "700", color: "#2d394c" },
  monthStats: {
    flexDirection: "row",
    marginTop: 14,
    paddingVertical: 16,
    borderRadius: 17,
    backgroundColor: colors.primary,
  },
  statItem: { flex: 1, alignItems: "center" },
  statItemBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  statValue: { fontSize: 18, fontWeight: "700", color: colors.white },
  statLabel: { marginTop: 2, fontSize: 8, color: "rgba(255,255,255,0.65)" },
  recordsHeading: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  recordsHeadingStrong: { fontSize: 13, fontWeight: "700", color: "#344155" },
  recordsHeadingLight: { fontSize: 10, color: "#98a2ad" },
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#e8ecef",
    backgroundColor: colors.white,
  },
  recordDate: { width: 44, alignItems: "center", borderRightWidth: 1, borderRightColor: "#edf0f2" },
  recordDay: { fontSize: 19, fontWeight: "700", color: "#27354a" },
  recordDow: { fontSize: 8, fontWeight: "700", color: "#9aa4ae" },
  recordInfo: { flex: 1, flexDirection: "row", justifyContent: "space-between", marginLeft: 12 },
  recordInfoLabel: { fontSize: 8, color: "#a0a9b2" },
  recordInfoValue: { fontSize: 10, fontWeight: "700", color: "#3c4859" },
  statusBadge: { position: "absolute", right: 9, top: 8, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 8 },
  statusGood: { backgroundColor: colors.successBg },
  statusLate: { backgroundColor: colors.warningBg },
  statusBadgeText: { fontSize: 7, fontWeight: "700" },
  statusGoodText: { color: "#25805c" },
  statusLateText: { color: colors.warning },
});
