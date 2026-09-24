import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Icon } from "../components/Icon";
import { registrarEntrada, registrarSalida, ApiError } from "../api/client";
import type { GoFn } from "../navigation/types";

export function CameraScreen({ go, tipo = "entrada" }: { go: GoFn; tipo?: "entrada" | "salida" }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [seconds, setSeconds] = useState(3);
  const [faceDetected] = useState(true); // placeholder: detección real vía librería de visión si se requiere
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          clearInterval(timer);
          if (!capturedRef.current) {
            capturedRef.current = true;
            capture();
          }
          return 0;
        }
        return value - 1;
      });
    }, 850);
    return () => clearInterval(timer);
  }, []);

  const capture = async () => {
    setEnviando(true);
    setError(null);
    try {
      const foto = await cameraRef.current?.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (!foto?.uri) throw new Error("No se pudo tomar la foto");

      const enviar = tipo === "entrada" ? registrarEntrada : registrarSalida;
      const respuesta = await enviar(foto.uri);

      go("confirmation", {
        result: {
          tipo,
          hora: respuesta.hora,
          puntualidad: respuesta.puntualidad,
          jornadaTotal: respuesta.jornadaTotal,
        },
      });
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : "No se pudo registrar tu asistencia. Intenta de nuevo.";
      setError(mensaje);
      setEnviando(false);
      capturedRef.current = false;
    }
  };

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.permissionText}>
          Necesitamos acceso a tu cámara para registrar tu asistencia.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Dar permiso</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.permissionText}>{error}</Text>
        <Pressable
          style={styles.permissionButton}
          onPress={() => {
            setError(null);
            setSeconds(3);
            capturedRef.current = false;
          }}
        >
          <Text style={styles.permissionButtonText}>Reintentar</Text>
        </Pressable>
        <Pressable style={{ marginTop: 14 }} onPress={() => go("home")}>
          <Text style={{ color: "#fff", fontSize: 12 }}>Volver al inicio</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      <View style={styles.shade} pointerEvents="none" />

      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => go("home")}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Verificación facial</Text>
        <View style={{ width: 35 }} />
      </View>

      <View style={styles.main}>
        <View style={styles.faceFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <View style={styles.message}>
          {faceDetected && (
            <View style={styles.statusChip}>
              <View style={styles.statusChipDot} />
              <Text style={styles.statusChipText}>Rostro detectado</Text>
            </View>
          )}
          <Text style={styles.title}>Mira de frente</Text>
          <Text style={styles.subtitle}>
            {enviando ? "Enviando registro..." : "La fotografía se tomará automáticamente"}
          </Text>
          <View style={styles.countdown}>
            {seconds > 0 ? (
              <Text style={styles.countdownText}>{seconds}</Text>
            ) : (
              <Icon name="check" size={27} color="#fff" />
            )}
          </View>
        </View>
      </View>

      <View style={styles.privacy}>
        <Icon name="lock" size={14} color="rgba(255,255,255,0.65)" />
        <Text style={styles.privacyText}>Foto protegida y de uso exclusivo para asistencia</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#172025" },
  centered: { alignItems: "center", justifyContent: "center", padding: 24 },
  permissionText: { color: "#fff", textAlign: "center", marginBottom: 16 },
  permissionButton: { backgroundColor: "#176b71", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  permissionButtonText: { color: "#fff", fontWeight: "700" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,15,20,0.35)" },
  header: {
    height: 49,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  closeButton: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  closeText: { color: "#fff", fontSize: 24 },
  headerTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  main: { flex: 1, alignItems: "center", paddingTop: 50 },
  faceFrame: {
    width: 235,
    height: 300,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  corner: { position: "absolute", width: 45, height: 45, borderColor: "#fff" },
  cornerTL: { left: -2, top: 24, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 22 },
  cornerTR: { right: -2, top: 24, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 22 },
  cornerBL: { left: -2, bottom: 24, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 22 },
  cornerBR: { right: -2, bottom: 24, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 22 },
  message: { marginTop: 23, alignItems: "center" },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(24,111,94,0.75)",
  },
  statusChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5fe3a9" },
  statusChipText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  title: { marginTop: 12, fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.72)" },
  countdown: {
    width: 49,
    height: 49,
    marginTop: 17,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  countdownText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  privacy: {
    position: "absolute",
    bottom: 23,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  privacyText: { fontSize: 9, color: "rgba(255,255,255,0.65)" },
});
