import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { FingerprintScreen } from "./src/screens/FingerprintScreen";
import { CameraScreen } from "./src/screens/CameraScreen";
import { ConfirmationScreen } from "./src/screens/ConfirmationScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import type { Screen } from "./src/navigation/types";

// Navegación simple por estado, igual que el prototipo original de
// Figma Make. Cuando el equipo lo requiera, esto se puede migrar a
// @react-navigation/native sin tocar las pantallas (cada una ya
// recibe `go` como única prop de navegación).
export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const go = (next: Screen) => setScreen(next);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {screen === "login" && <LoginScreen onContinue={() => go("home")} />}
      {screen === "home" && <HomeScreen go={go} />}
      {screen === "fingerprint" && <FingerprintScreen go={go} />}
      {screen === "camera" && <CameraScreen go={go} />}
      {screen === "confirmation" && <ConfirmationScreen go={go} />}
      {screen === "history" && <HistoryScreen go={go} />}
      {screen === "profile" && <ProfileScreen go={go} />}
    </SafeAreaProvider>
  );
}
