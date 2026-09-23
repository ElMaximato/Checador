import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { colors } from "../theme/colors";

// TODO backend: reemplazar este mock por la validación real de la
// sesión de dispositivo (Capa 1: PIN de activación / refresh token
// guardado en expo-secure-store). Este componente solo dispara
// onContinue() cuando la sesión de dispositivo es válida.
export function LoginScreen({ onContinue }: { onContinue: () => void }) {
  const [loading, setLoading] = useState(false);

  const identify = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onContinue();
    }, 650);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.main}>
        <View style={styles.brandMark}>
          <Icon name="shield" size={31} color={colors.white} />
        </View>
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Text style={styles.eyebrow}>NEXORA EMPRESARIAL</Text>
          <Text style={styles.title}>Bienvenido</Text>
          <Text style={styles.subtitle}>
            Identifícate para registrar tu jornada de forma segura.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.biometricCard,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
          disabled={loading}
          onPress={identify}
        >
          <View style={[styles.orb, loading && styles.orbScanning]}>
            <Icon name="fingerprint" size={48} color={loading ? colors.white : colors.primaryDark} />
          </View>
          <Text style={styles.biometricTitle}>
            {loading ? "Verificando identidad..." : "Toca para identificarte"}
          </Text>
          <Text style={styles.biometricSubtitle}>
            {loading ? "Esto tomará sólo un momento" : "Usa tu huella digital"}
          </Text>
        </Pressable>

        <View style={styles.secureNote}>
          <Icon name="lock" size={16} color="#2b8589" />
          <Text style={styles.secureNoteText}>Tus datos biométricos están protegidos</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={onContinue}>
          <Text style={styles.footerLink}>Usar ID de empleado</Text>
        </Pressable>
        <Text style={styles.footerVersion}>Control de asistencia · Versión 2.4</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgLoginScreen },
  main: { flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 38 },
  brandMark: {
    width: 66,
    height: 66,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    shadowColor: "#125c62",
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.7, color: "#18676c" },
  title: { marginTop: 12, fontSize: 31, fontWeight: "700", color: "#0f172a", letterSpacing: -0.8 },
  subtitle: {
    marginTop: 8,
    maxWidth: 290,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  biometricCard: {
    width: "100%",
    marginTop: 48,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e3e9ee",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#24374f",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  orb: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#cbe4e2",
  },
  orbScanning: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  biometricTitle: { marginTop: 18, fontSize: 16, color: "#15233c", fontWeight: "600" },
  biometricSubtitle: { marginTop: 5, fontSize: 13, color: "#7b8796" },
  secureNote: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 23 },
  secureNoteText: { fontSize: 12, color: "#7e8a97" },
  footer: { alignItems: "center", paddingBottom: 28, paddingTop: 12 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  footerVersion: { marginTop: 24, fontSize: 10, color: "#a1aab4", letterSpacing: 0.4 },
});
