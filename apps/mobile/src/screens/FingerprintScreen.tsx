import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { Icon } from "../components/Icon";
import { colors } from "../theme/colors";
import type { Screen } from "../navigation/types";

type ScanState = "idle" | "scanning" | "error";

export function FingerprintScreen({ go }: { go: (s: Screen) => void }) {
  const [state, setState] = useState<ScanState>("idle");

  const scan = async () => {
    setState("scanning");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirma tu identidad",
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
      });
      if (result.success) {
        // La huella solo confirma "eres el dueño de este teléfono".
        // El siguiente paso (cámara) es la evidencia de asistencia real.
        go("camera");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => go("home")}>
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Verificación</Text>
        <View style={{ width: 35 }} />
      </View>

      <View style={styles.main}>
        <View style={styles.stepIndicator}>
          <View style={[styles.step, styles.stepActive]} />
          <View style={styles.step} />
          <View style={styles.step} />
        </View>
        <Text style={styles.eyebrow}>PASO 1 DE 3</Text>
        <Text style={styles.title}>Confirma tu identidad</Text>
        <Text style={styles.copy}>
          Coloca tu dedo en el sensor para continuar con tu registro de salida.
        </Text>

        <Pressable
          style={[styles.orb, state === "scanning" && styles.orbScanning]}
          onPress={scan}
        >
          <Icon name="fingerprint" size={72} color={state === "scanning" ? colors.white : "#1b7479"} />
        </Pressable>

        <Text style={styles.scanTitle}>
          {state === "scanning"
            ? "Leyendo huella..."
            : state === "error"
              ? "No pudimos verificarte"
              : "Toca el sensor"}
        </Text>
        <Text style={[styles.scanHelp, state === "error" && { color: "#ef4444" }]}>
          {state === "error" ? "Limpia el sensor e inténtalo nuevamente." : "Mantén el dedo sobre el sensor"}
        </Text>

        {state === "error" && (
          <Pressable style={styles.retryButton} onPress={scan}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.problemLink} onPress={() => setState("error")}>
        <Text style={styles.problemLinkText}>¿Tienes problemas con el sensor?</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgLoginScreen },
  header: {
    height: 49,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  backChevron: { fontSize: 29, color: "#26344a" },
  headerTitle: { fontSize: 14, fontWeight: "600", color: "#26344a" },
  main: { flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 27 },
  stepIndicator: { flexDirection: "row", gap: 6, marginBottom: 31 },
  step: { width: 22, height: 3, borderRadius: 5, backgroundColor: "#dbe3e8" },
  stepActive: { width: 32, backgroundColor: "#28777b" },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.7, color: "#18676c" },
  title: { marginTop: 11, fontSize: 27, fontWeight: "700", color: "#14233c", letterSpacing: -0.6 },
  copy: { maxWidth: 310, marginTop: 9, textAlign: "center", fontSize: 14, lineHeight: 22, color: "#788594" },
  orb: {
    width: 166,
    height: 166,
    marginVertical: 40,
    borderRadius: 83,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f4f3",
    borderWidth: 1,
    borderColor: "#d2e9e7",
  },
  orbScanning: { backgroundColor: "#1a7378", borderColor: "#1a7378" },
  scanTitle: { fontSize: 16, color: "#263348", fontWeight: "600" },
  scanHelp: { marginTop: 5, fontSize: 12, color: "#919ba6" },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  problemLink: { alignSelf: "center", marginBottom: 32 },
  problemLinkText: { color: "#246f73", fontSize: 12, fontWeight: "600" },
});
