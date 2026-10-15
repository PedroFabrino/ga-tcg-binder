import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Keyboard, Monitor, QrCode, Zap } from "lucide-react-native";
import { parsePairingPayload } from "../../lib/pairing";
import { useFeedback } from "../../lib/feedback";
import { useSessionStore } from "../../store/sessionStore";
import { colors, radius, space, type } from "../../theme";
import { Button } from "../shared/Button";
import { ManualPairModal } from "./ManualPairModal";

const WINDOW = 248;

export function PairingView() {
  const [permission, requestPermission] = useCameraPermissions();
  const status = useSessionStore((s) => s.status);
  const error = useSessionStore((s) => s.error);
  const pair = useSessionStore((s) => s.pair);
  const simulatePairing = useSessionStore((s) => s.simulatePairing);
  const clearError = useSessionStore((s) => s.clearError);
  const feedback = useFeedback();
  const [manualOpen, setManualOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lastRejected = useRef<string | null>(null);
  const laser = useRef(new Animated.Value(0)).current;
  const connecting = status === "CONNECTING";

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laser, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(laser, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [laser]);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const payload = parsePairingPayload(data);
    if (!payload) {
      if (lastRejected.current !== data) {
        lastRejected.current = data;
        setNotice("That QR code isn't a GA TCG pairing code.");
        feedback.warn();
      }
      return;
    }
    lastRejected.current = null;
    setNotice(null);
    clearError();
    feedback.lock();
    pair(payload.sessionId);
  };

  const message = error ?? notice;

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.brandMark}>
          <Monitor size={18} color={colors.violetBright} />
        </View>
        <Text style={styles.title}>Pair with your desktop</Text>
        <Text style={styles.subtitle}>Open the scanner in GA TCG Binder on your computer and point this camera at the QR code.</Text>
      </View>

      <View style={styles.window}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={connecting ? undefined : onScanned}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.laser, { transform: [{ translateY: laser.interpolate({ inputRange: [0, 1], outputRange: [16, WINDOW - 16] }) }] }]}
            />
            {(["tl", "tr", "bl", "br"] as const).map((c) => (
              <View key={c} pointerEvents="none" style={[styles.corner, cornerStyles[c]]} />
            ))}
          </>
        ) : (
          <View style={styles.permission}>
            <QrCode size={32} color={colors.textDim} />
            <Text style={styles.permissionText}>
              {permission?.canAskAgain === false
                ? "Camera access is turned off. Enable it in your phone's settings to scan."
                : "Camera access is needed to scan the pairing code."}
            </Text>
            {permission?.canAskAgain !== false && <Button label="Allow camera" variant="secondary" onPress={() => void requestPermission()} />}
          </View>
        )}
        {connecting && (
          <View style={styles.connecting}>
            <ActivityIndicator color={colors.emerald} />
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}
      </View>

      <View style={styles.messageSlot}>{message && <Text style={styles.error}>{message}</Text>}</View>

      <View style={styles.actions}>
        <Button
          label="Enter code manually"
          variant="secondary"
          icon={<Keyboard size={18} color={colors.text} />}
          onPress={() => setManualOpen(true)}
          disabled={connecting}
        />
        {__DEV__ && <Button label="Simulate Pairing" variant="brand" icon={<Zap size={18} color={colors.text} />} onPress={simulatePairing} disabled={connecting} />}
      </View>

      <ManualPairModal visible={manualOpen} onClose={() => setManualOpen(false)} />
    </View>
  );
}

const CORNER = 28;
const cornerStyles = StyleSheet.create({
  tl: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space(3), justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: space(4) },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.violetSoft,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(2),
  },
  title: { ...type.display, color: colors.text, textAlign: "center" },
  subtitle: { ...type.body, color: colors.textMuted, textAlign: "center", marginTop: space(1), maxWidth: 320 },
  window: {
    alignSelf: "center",
    width: WINDOW,
    height: WINDOW,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permission: { flex: 1, alignItems: "center", justifyContent: "center", gap: space(2), padding: space(3) },
  permissionText: { ...type.body, color: colors.textMuted, textAlign: "center" },
  laser: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.emeraldBright,
    shadowColor: colors.emerald,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.emeraldBright },
  connecting: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", gap: space(1) },
  connectingText: { ...type.bodyStrong, color: colors.text },
  messageSlot: { minHeight: 48, justifyContent: "center", paddingHorizontal: space(2) },
  error: { ...type.body, color: colors.red, textAlign: "center" },
  actions: { gap: space(1.5) },
});
