import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { colors } from "../theme/colors";
import type { Screen } from "../navigation/types";

const items: { label: string; icon: IconName; screen: Screen }[] = [
  { label: "Inicio", icon: "home", screen: "home" },
  { label: "Historial", icon: "calendar", screen: "history" },
  { label: "Perfil", icon: "user", screen: "profile" },
];

export function BottomNav({
  screen,
  go,
}: {
  screen: Screen;
  go: (s: Screen) => void;
}) {
  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const active = screen === item.screen;
        return (
          <Pressable
            key={item.screen}
            style={styles.item}
            onPress={() => go(item.screen)}
          >
            {active && <View style={styles.activeBar} />}
            <Icon name={item.icon} size={21} color={active ? colors.primary : "#9aa4af"} />
            <Text style={[styles.label, active && { color: colors.primary }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 74,
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopWidth: 1,
    borderTopColor: "#e8ecef",
    paddingTop: 10,
    paddingBottom: 12,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  activeBar: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 2,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 9,
    fontWeight: "600",
    color: "#9aa4af",
  },
});
