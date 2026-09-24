import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Device from "expo-device";
import { Icon } from "../components/Icon";
import { colors } from "../theme/colors";
import { activarDispositivo } from "../api/client";
import { guardarToken, obtenerOCrearDeviceId } from "../api/session";
import type { GoFn } from "../navigation/types";

// Pantalla que se muestra SOLO la primera vez (o si el admin revocó
// el dispositivo y hay que reactivar). RH le da al empleado su ID +
// el PIN de un solo uso generado desde el Admin Web.
export function ActivationScreen({ go }: { go: GoFn }) {
  const [empleadoId, setEmpleadoId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activar = async () => {
    if (!empleadoId || !pin) {
      setError("Ingresa tu ID de empleado y el PIN.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const deviceId = await obtenerOCrearDeviceId();
      const deviceInfo = `${Device.modelName ?? "desconocido"} / ${Device.osName ?? ""} ${Device.osVersion ?? ""}`;
      const { token } = await activarDispositivo({ empleadoId, pin, deviceId, deviceInfo });
      await guardarToken(token);
      go("home");
    } catch (err: any) {
      setError(err?.message || "No se pudo activar el dispositivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.main}>
        <View style={styles.brandMark}>
          <Icon name="shield" size={31} color={colors.white} />
        </View>
        <Text style={styles.eyebrow}>ACTIVAR MI CUENTA</Text>
        <Text style={styles.title}>Vincula este teléfono</Text>
        <Text style={styles.subtitle}>
          Ingresa el ID de empleado y el PIN que te dio RH. Esto se hace una sola vez.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>ID de empleado</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. NX-2847"
            placeholderTextColor="#a7b0ba"
            autoCapitalize="characters"
            value={empleadoId}
            onChangeText={setEmpleadoId}
          />

          <Text style={styles.label}>PIN de activación</Text>
          <TextInput
            style={styles.input}
            placeholder="6 dígitos"
            placeholderTextColor="#a7b0ba"
            keyboardType="number-pad"
            maxLength={6}
            value={pin}
            onChangeText={setPin}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} onPress={activar} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Activar</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgLoginScreen },
  main: { flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 50 },
  brandMark: {
    width: 66,
    height: 66,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
  },
  eyebrow: { marginTop: 18, fontSize: 11, fontWeight: "700", letterSpacing: 1.7, color: "#18676c" },
  title: { marginTop: 10, fontSize: 26, fontWeight: "700", color: "#0f172a", letterSpacing: -0.6 },
  subtitle: {
    marginTop: 8,
    maxWidth: 290,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  form: { width: "100%", marginTop: 34 },
  label: { fontSize: 12, fontWeight: "600", color: "#3c4859", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#dfe6ea",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#14213d",
    backgroundColor: colors.white,
  },
  error: { marginTop: 14, color: "#c0392b", fontSize: 12, textAlign: "center" },
  button: {
    marginTop: 26,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
});
