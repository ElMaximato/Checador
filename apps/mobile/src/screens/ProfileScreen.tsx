import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "../components/Icon";
import { BottomNav } from "../components/BottomNav";
import { colors } from "../theme/colors";
import type { Screen } from "../navigation/types";

// TODO backend: GET /api/empleados/me — nombre, puesto, avatar,
// departamento y horario asignado.
const portrait =
  "https://images.unsplash.com/photo-1758600587839-56ba05596c69?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=900&q=85&w=700";

const rows: { icon: IconName; label: string; value: string }[] = [
  { icon: "id", label: "ID de empleado", value: "NX-2847" },
  { icon: "building", label: "Departamento", value: "Operaciones" },
  { icon: "clock", label: "Horario asignado", value: "09:00 – 18:00" },
];

export function ProfileScreen({ go }: { go: (s: Screen) => void }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MI CUENTA</Text>
            <Text style={styles.title}>Perfil</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: portrait }} style={styles.avatar} />
            <View style={styles.avatarDot} />
          </View>
          <Text style={styles.name}>Mariana Torres</Text>
          <Text style={styles.role}>Coordinadora de Operaciones</Text>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>Empleado activo</Text>
          </View>
        </View>

        <View style={styles.details}>
          <Text style={styles.sectionLabel}>INFORMACIÓN LABORAL</Text>
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
          <Pressable style={styles.settingsRow}>
            <View style={styles.settingsRowLeft}>
              <Icon name="bell" size={19} color="#28757a" />
              <Text style={styles.settingsRowText}>Notificaciones</Text>
            </View>
            <Icon name="chevron" size={17} color="#3c495c" />
          </Pressable>
          <Pressable style={styles.settingsRow}>
            <View style={styles.settingsRowLeft}>
              <Icon name="shield" size={19} color="#28757a" />
              <Text style={styles.settingsRowText}>Privacidad y seguridad</Text>
            </View>
            <Icon name="chevron" size={17} color="#3c495c" />
          </Pressable>
          <Pressable style={[styles.settingsRow, { borderBottomWidth: 0 }]} onPress={() => go("login")}>
            <View style={styles.settingsRowLeft}>
              <Icon name="logout" size={19} color={colors.danger} />
              <Text style={[styles.settingsRowText, { color: colors.danger }]}>Cerrar sesión</Text>
            </View>
          </Pressable>
        </View>
      </View>
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
  hero: { alignItems: "center", paddingVertical: 16 },
  avatarWrap: { width: 88, height: 88, marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: colors.white },
  avatarDot: {
    position: "absolute",
    right: 3,
    bottom: 5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#3aaa77",
    borderWidth: 3,
    borderColor: colors.white,
  },
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
  sectionLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.3, color: "#277277", marginBottom: 4 },
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
