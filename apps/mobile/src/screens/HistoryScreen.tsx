import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { BottomNav } from "../components/BottomNav";
import { colors } from "../theme/colors";
import type { Screen } from "../navigation/types";

// TODO backend: reemplazar por GET /api/jornadas?empleado_id=&mes=
const records = [
  { day: "12", dow: "JUE", entry: "08:57", exit: "17:00", hours: "8 h 03 min", status: "A tiempo", good: true },
  { day: "11", dow: "MIÉ", entry: "09:08", exit: "18:02", hours: "8 h 54 min", status: "Retardo", good: false },
  { day: "10", dow: "MAR", entry: "08:51", exit: "17:04", hours: "8 h 13 min", status: "A tiempo", good: true },
  { day: "09", dow: "LUN", entry: "08:55", exit: "17:01", hours: "8 h 06 min", status: "A tiempo", good: true },
];

export function HistoryScreen({ go }: { go: (s: Screen) => void }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MI ACTIVIDAD</Text>
            <Text style={styles.title}>Historial</Text>
          </View>
          <Pressable style={styles.iconButton}>
            <Icon name="calendar" size={20} color="#3e4a5c" />
          </Pressable>
        </View>

        <View style={styles.monthSelector}>
          <Text style={styles.monthArrow}>‹</Text>
          <Text style={styles.monthLabel}>Junio 2025</Text>
          <Text style={styles.monthArrow}>›</Text>
        </View>

        <View style={styles.monthStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>9</Text>
            <Text style={styles.statLabel}>Días laborados</Text>
          </View>
          <View style={[styles.statItem, styles.statItemBorder]}>
            <Text style={styles.statValue}>72.4 h</Text>
            <Text style={styles.statLabel}>Horas totales</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>96%</Text>
            <Text style={styles.statLabel}>Puntualidad</Text>
          </View>
        </View>

        <View style={styles.recordsHeading}>
          <Text style={styles.recordsHeadingStrong}>Esta semana</Text>
          <Text style={styles.recordsHeadingLight}>{records.length} registros</Text>
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => item.day}
          contentContainerStyle={{ gap: 8, paddingBottom: 90 }}
          renderItem={({ item }) => (
            <View style={styles.recordCard}>
              <View style={styles.recordDate}>
                <Text style={styles.recordDay}>{item.day}</Text>
                <Text style={styles.recordDow}>{item.dow}</Text>
              </View>
              <View style={styles.recordInfo}>
                <View>
                  <Text style={styles.recordInfoLabel}>Entrada</Text>
                  <Text style={styles.recordInfoValue}>{item.entry}</Text>
                </View>
                <View>
                  <Text style={styles.recordInfoLabel}>Salida</Text>
                  <Text style={styles.recordInfoValue}>{item.exit}</Text>
                </View>
                <View>
                  <Text style={styles.recordInfoLabel}>Total</Text>
                  <Text style={styles.recordInfoValue}>{item.hours}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, item.good ? styles.statusGood : styles.statusLate]}>
                <Text style={[styles.statusBadgeText, item.good ? styles.statusGoodText : styles.statusLateText]}>
                  {item.status}
                </Text>
              </View>
            </View>
          )}
        />
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
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#edf0f2",
  },
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
