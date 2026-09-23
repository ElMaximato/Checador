import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { colors } from "../theme/colors";
import type { AttendanceResult, Screen } from "../navigation/types";

// TODO backend: `result` debe venir de la respuesta de
// POST /api/attendance (hora, puntualidad, jornada total ya
// calculadas por el servidor). Por ahora se usa un mock.
const mockResult: AttendanceResult = {
  tipo: "salida",
  hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }),
  puntualidad: "a_tiempo",
  jornadaTotal: "8 h 03 min",
};

export function ConfirmationScreen({
  go,
  result = mockResult,
}: {
  go: (s: Screen) => void;
  result?: AttendanceResult;
}) {
  const today = new Date().toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.main}>
        <View style={styles.successMark}>
          <Icon name="check" size={42} color={colors.white} />
        </View>
        <Text style={styles.eyebrow}>REGISTRO EXITOSO</Text>
        <Text style={styles.title}>
          {result.tipo === "entrada" ? "Entrada registrada" : "Salida registrada"}
        </Text>
        <Text style={styles.subtitle}>Tu asistencia se guardó correctamente.</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {result.tipo === "entrada" ? "HORA DE ENTRADA" : "HORA DE SALIDA"}
          </Text>
          <Text style={styles.cardTime}>{result.hora}</Text>
          <Text style={styles.cardDate}>{today}</Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Estado</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={styles.onTimeDot} />
              <Text style={styles.onTimeText}>
                {result.puntualidad === "a_tiempo" ? "A tiempo" : "Con retardo"}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Ubicación</Text>
            <Text style={styles.rowValue}>Oficina Central</Text>
          </View>
          {result.jornadaTotal && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Jornada total</Text>
              <Text style={styles.rowValue}>{result.jornadaTotal}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.solidButton} onPress={() => go("home")}>
          <Text style={styles.solidButtonText}>Volver al inicio</Text>
        </Pressable>
        <Pressable onPress={() => go("history")}>
          <Text style={styles.textButton}>Ver en mi historial</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3faf7" },
  main: { flex: 1, alignItems: "center", paddingHorizontal: 23, paddingTop: 36 },
  successMark: {
    width: 85,
    height: 85,
    marginBottom: 22,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2b8b64",
    shadowColor: "#2b8b64",
    shadowOpacity: 0.23,
    shadowRadius: 15,
  },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.7, color: "#047857" },
  title: { marginTop: 10, fontSize: 28, fontWeight: "700", color: "#15233b", letterSpacing: -0.6 },
  subtitle: { marginTop: 7, fontSize: 13, color: "#7e8997" },
  card: {
    width: "100%",
    marginTop: 27,
    padding: 20,
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#e3ebe7",
  },
  cardLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.2, color: "#98a2ac" },
  cardTime: { marginTop: 2, fontSize: 38, fontWeight: "700", color: "#17263d", letterSpacing: -1.5 },
  cardDate: { fontSize: 11, color: "#84909d" },
  divider: { height: 1, backgroundColor: "#edf0f1", marginVertical: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7 },
  rowLabel: { fontSize: 12, color: "#8994a0" },
  rowValue: { fontSize: 12, fontWeight: "600", color: "#354255" },
  onTimeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#37a474" },
  onTimeText: { fontSize: 12, fontWeight: "600", color: "#2d8a64" },
  solidButton: {
    width: "100%",
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  solidButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  textButton: { marginTop: 14, fontSize: 12, fontWeight: "700", color: "#28757a" },
});
