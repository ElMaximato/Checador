import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "../components/Icon";
import { BottomNav } from "../components/BottomNav";
import { colors } from "../theme/colors";
import { ApiError, desvincularDispositivo, obtenerPerfil, type Perfil } from "../api/client";
import { borrarToken } from "../api/session";
import type { GoFn } from "../navigation/types";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function ProfileScreen({ go }: { go: GoFn }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuSesion, setMenuSesion] = useState(false);

  const cargar = () => {
    setCargando(true);
    setError(null);
    obtenerPerfil()
      .then(setPerfil)
      .catch((e) => setError(e?.message ?? "No se pudo cargar tu perfil"))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  // Cerrar sesión: solo bloquea la app (vuelve al candado biométrico).
  const cerrarSesion = () => {
    setMenuSesion(false);
    go("login");
  };

  // Desvincular: revoca este teléfono en el servidor y borra la activación
  // local. Para volver a usar la app hace falta un PIN nuevo de RH.
  const confirmarDesvincular = () => {
    setMenuSesion(false);
    Alert.alert(
      "¿Desvincular este celular?",
      "Se quitará este teléfono de tu cuenta y la app volverá a la pantalla de activación. Para usarla otra vez necesitarás un PIN nuevo de RH.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Desvincular", style: "destructive", onPress: desvincular },
      ]
    );
  };

  const desvincular = async () => {
    try {
      await desvincularDispositivo();
      await borrarToken();
      go("activation");
    } catch (e: any) {
      // 401: el cliente API ya borró el token y mandó a Activación.
      if (e instanceof ApiError && e.status === 401) return;
      Alert.alert("No se pudo desvincular", e?.message ?? "Inténtalo de nuevo.");
    }
  };

  const rows: { icon: IconName; label: string; value: string }[] = perfil
    ? [
        { icon: "id", label: "ID de empleado", value: perfil.codigo },
        { icon: "building", label: "Departamento", value: perfil.departamento },
      ]
    : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MI CUENTA</Text>
            <Text style={styles.title}>Perfil</Text>
          </View>
        </View>

        {cargando ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : error || !perfil ? (
          <View style={{ alignItems: "center", marginTop: 40, gap: 12 }}>
            <Text style={styles.message}>{error ?? "No se pudo cargar tu perfil"}</Text>
            <Pressable style={styles.retry} onPress={cargar}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{iniciales(perfil.nombre)}</Text>
              </View>
              <Text style={styles.name}>{perfil.nombre}</Text>
              <Text style={styles.role}>{perfil.puesto}</Text>
              {perfil.estado === "activo" && (
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>Empleado activo</Text>
                </View>
              )}
            </View>

            <View style={styles.details}>
              {rows.map((row, i) => (
                <View key={row.label} style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.rowIcon}>
                    <Icon name={row.icon} size={19} color="#247479" />
                  </View>
                  <View>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowValue}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.settingsList}>
              <Pressable style={[styles.settingsRow, { borderBottomWidth: 0 }]} onPress={() => setMenuSesion(true)}>
                <View style={styles.settingsRowLeft}>
                  <Icon name="logout" size={19} color={colors.danger} />
                  <Text style={[styles.settingsRowText, { color: colors.danger }]}>Cerrar sesión</Text>
                </View>
              </Pressable>
            </View>
          </>
        )}
      </View>
      <Modal visible={menuSesion} transparent animationType="fade" onRequestClose={() => setMenuSesion(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuSesion(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Sesión</Text>

            <Pressable style={styles.option} onPress={cerrarSesion}>
              <View style={styles.optionIcon}>
                <Icon name="lock" size={19} color="#247479" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Cerrar sesión</Text>
                <Text style={styles.optionText}>Bloquea la app. Vuelves a entrar con tu huella o rostro.</Text>
              </View>
            </Pressable>

            <Pressable style={styles.option} onPress={confirmarDesvincular}>
              <View style={[styles.optionIcon, { backgroundColor: colors.warningBg }]}>
                <Icon name="logout" size={19} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: colors.danger }]}>Desvincular celular</Text>
                <Text style={styles.optionText}>
                  Quita este teléfono de tu cuenta. Necesitarás un PIN nuevo de RH para volver a activarlo.
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.cancel} onPress={() => setMenuSesion(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <BottomNav go={go} screen="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  content: { flex: 1, paddingHorizontal: 23, paddingTop: 18, paddingBottom: 90 },
  header: { paddingBottom: 8 },
  eyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1.3, color: "#277277" },
  title: { fontSize: 24, fontWeight: "700", color: "#11213b", letterSpacing: -0.5 },
  message: { fontSize: 12, color: "#7f8a98", textAlign: "center" },
  retry: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontSize: 12, fontWeight: "700", color: colors.white },
  hero: { alignItems: "center", paddingVertical: 16 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  avatarText: { fontSize: 26, fontWeight: "700", color: colors.primary },
  name: { fontSize: 20, fontWeight: "700", color: "#19273e" },
  role: { marginTop: 2, fontSize: 12, color: "#7f8a98" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: colors.successBg,
  },
  activeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#37a474" },
  activeBadgeText: { fontSize: 9, fontWeight: "700", color: "#328261" },
  details: {
    padding: 17,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e6ebee",
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f2",
  },
  rowIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9f3f3",
  },
  rowLabel: { fontSize: 9, color: "#98a1ab" },
  rowValue: { marginTop: 1, fontSize: 12, fontWeight: "700", color: "#344154" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,33,59,0.45)" },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.white,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#19273e", marginBottom: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f2",
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9f3f3",
  },
  optionTitle: { fontSize: 13, fontWeight: "700", color: "#344154" },
  optionText: { marginTop: 2, fontSize: 11, lineHeight: 15, color: "#7f8a98" },
  cancel: { marginTop: 14, paddingVertical: 13, borderRadius: 14, alignItems: "center", backgroundColor: "#f1f5f6" },
  cancelText: { fontSize: 13, fontWeight: "700", color: "#536273" },
  settingsList: {
    marginTop: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e6ebee",
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f2",
  },
  settingsRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingsRowText: { fontSize: 11, fontWeight: "600", color: "#3c495c" },
});
