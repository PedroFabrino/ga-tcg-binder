import { useEffect, useRef } from "react";
import { Alert, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Flashlight, FlashlightOff, Layers } from "lucide-react-native";
import { useScannerStore } from "../../store/scannerStore";
import { useSessionStore } from "../../store/sessionStore";
import { colors, radius, space, type } from "../../theme";
import { PressableScale } from "../shared/Button";

function latencyTone(ms: number | null) {
  if (ms === null) return colors.textDim;
  if (ms < 80) return colors.emeraldBright;
  if (ms < 180) return colors.amber;
  return colors.red;
}

export function ScannerHeader({ onTap }: { onTap: () => void }) {
  const status = useSessionStore((s) => s.status);
  const session = useSessionStore((s) => s.session);
  const latencyMs = useSessionStore((s) => s.latencyMs);
  const disconnect = useSessionStore((s) => s.disconnect);
  const count = useScannerStore((s) => s.scanned.length);
  const torch = useScannerStore((s) => s.settings.torch);
  const facing = useScannerStore((s) => s.settings.facing);
  const updateSettings = useScannerStore((s) => s.updateSettings);
  const resetScanner = useScannerStore((s) => s.reset);

  const pulse = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const reconnecting = status === "RECONNECTING";

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (count === 0) return;
    bump.setValue(1.25);
    Animated.spring(bump, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
  }, [count, bump]);

  const dotColor = reconnecting ? colors.amber : colors.emerald;
  const torchDisabled = facing === "front";

  const openSession = () => {
    onTap();
    Alert.alert(session?.desktopName ?? "Desktop", reconnecting ? "Reconnecting to your desktop..." : "Cards you confirm are sent to this desktop.", [
      { text: "Keep scanning", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: () => {
          resetScanner();
          disconnect();
        },
      },
    ]);
  };

  return (
    <View style={styles.row}>
      <PressableScale onPress={openSession} style={[styles.glass, styles.session]} accessibilityLabel="Session details">
        <View style={styles.dotWrap}>
          <Animated.View
            style={[
              styles.dotPulse,
              { backgroundColor: dotColor, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] },
            ]}
          />
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        </View>
        <View style={styles.sessionText}>
          <Text style={styles.desktop} numberOfLines={1}>
            {session?.desktopName ?? "Desktop"}
          </Text>
          <Text style={[styles.latency, { color: reconnecting ? colors.amber : latencyTone(latencyMs) }]}>
            {reconnecting ? "Reconnecting..." : latencyMs === null ? "-- ms" : `${latencyMs} ms`}
          </Text>
        </View>
      </PressableScale>

      <View style={styles.right}>
        <Animated.View style={[styles.glass, styles.counter, { transform: [{ scale: bump }] }]}>
          <Layers size={15} color={colors.emeraldBright} />
          <Text style={styles.count}>{count}</Text>
        </Animated.View>
        <PressableScale
          disabled={torchDisabled}
          onPress={() => {
            onTap();
            updateSettings({ torch: !torch });
          }}
          style={[styles.glass, styles.iconButton, torch && !torchDisabled && styles.torchOn]}
          accessibilityLabel={torch ? "Turn off flashlight" : "Turn on flashlight"}
        >
          {torch && !torchDisabled ? <Flashlight size={18} color={colors.yellow} /> : <FlashlightOff size={18} color={colors.text} />}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1) },
  glass: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  session: { flexDirection: "row", alignItems: "center", gap: space(1.25), paddingLeft: space(1.5), paddingRight: space(2), height: 44, flexShrink: 1 },
  dotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotPulse: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  sessionText: { flexShrink: 1 },
  desktop: { fontSize: 13, lineHeight: 16, fontWeight: "600", color: colors.text },
  latency: { fontSize: 11, lineHeight: 14, ...type.mono },
  right: { flexDirection: "row", alignItems: "center", gap: space(1) },
  counter: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: space(1.5) },
  count: { ...type.bodyStrong, ...type.mono, color: colors.text },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  torchOn: { borderColor: "rgba(250, 204, 21, 0.55)", backgroundColor: colors.yellowSoft },
});
