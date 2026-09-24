import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ActivationScreen } from "./src/screens/ActivationScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { FingerprintScreen } from "./src/screens/FingerprintScreen";
import { CameraScreen } from "./src/screens/CameraScreen";
import { ConfirmationScreen } from "./src/screens/ConfirmationScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { obtenerToken } from "./src/api/session";
import { registrarManejadorSesionInvalida } from "./src/api/client";
import { colors } from "./src/theme/colors";
import type { NavParams, Screen } from "./src/navigation/types";

// Navegación simple por estado, igual que el prototipo original de
// Figma Make. Cada pantalla recibe `go` (y, si aplica, los params de
// la última navegación) como única forma de moverse entre ellas.
export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [params, setParams] = useState<NavParams>({});

  useEffect(() => {
    obtenerToken().then((token) => {
      // Con token guardado -> pedir biométrico (Login) para entrar.
      // Sin token -> primera vez, o dispositivo revocado -> Activación.
      setScreen(token ? "login" : "activation");
    });
  }, []);

  // Si el backend rechaza el token (RH revocó el dispositivo, o se
  // desvinculó), el cliente API ya borró el token: mandar a Activación.
  useEffect(() => {
    registrarManejadorSesionInvalida(() => {
      setParams({});
      setScreen("activation");
      Alert.alert(
        "Sesión finalizada",
        "Este teléfono ya no está vinculado a tu cuenta. Pide a RH un PIN nuevo para activarlo de nuevo."
      );
    });
    return () => registrarManejadorSesionInvalida(null);
  }, []);

  const go = (next: Screen, nextParams: NavParams = {}) => {
    setParams(nextParams);
    setScreen(next);
  };

  if (screen === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgLoginScreen }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {screen === "activation" && <ActivationScreen go={go} />}
      {screen === "login" && <LoginScreen onContinue={() => go("home")} />}
      {screen === "home" && <HomeScreen go={go} />}
      {screen === "fingerprint" && <FingerprintScreen go={go} tipo={params.tipo} />}
      {screen === "camera" && <CameraScreen go={go} tipo={params.tipo} />}
      {screen === "confirmation" && <ConfirmationScreen go={go} result={params.result} />}
      {screen === "history" && <HistoryScreen go={go} />}
      {screen === "profile" && <ProfileScreen go={go} />}
    </SafeAreaProvider>
  );
}
