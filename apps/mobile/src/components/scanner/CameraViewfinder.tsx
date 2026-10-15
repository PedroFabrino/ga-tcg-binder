import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera, FlaskConical, SwitchCamera } from "lucide-react-native";
import type { SubjectPose } from "../../hooks/useSimulatedFeed";
import { useScannerStore } from "../../store/scannerStore";
import { colors, radius, space, type } from "../../theme";
import { Button, PressableScale } from "../shared/Button";
import { CardArt } from "../shared/CardArt";

function SimulatedCard({ pose, width }: { pose: SubjectPose; width: number }) {
  const dx = useRef(new Animated.Value(pose.dx)).current;
  const dy = useRef(new Animated.Value(pose.dy)).current;
  const rotate = useRef(new Animated.Value(pose.rotate)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glare = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spring = (v: Animated.Value, toValue: number) => Animated.spring(v, { toValue, useNativeDriver: true, speed: 14, bounciness: 2 });
    Animated.parallel([
      spring(dx, pose.dx),
      spring(dy, pose.dy),
      spring(rotate, pose.rotate),
      Animated.timing(opacity, { toValue: pose.visible ? (pose.blur ? 0.75 : 1) : 0, duration: 220, useNativeDriver: true }),
      Animated.timing(glare, { toValue: pose.glare, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [pose, dx, dy, rotate, opacity, glare]);

  const { card, edition } = pose;
  if (!card || !edition) return null;
  const scale = width / 200;
  const art = (
    <CardArt name={card.name} element={card.element} setPrefix={edition.setPrefix} collectorNumber={edition.collectorNumber} imageUrl={edition.imageUrl} size="lg" />
  );

  return (
    <View pointerEvents="none" style={styles.center}>
      <Animated.View
        style={{
          opacity,
          transform: [{ translateX: dx }, { translateY: dy }, { rotate: rotate.interpolate({ inputRange: [-180, 180], outputRange: ["-180deg", "180deg"] }) }, { scale }],
        }}
      >
        {pose.blur && <View style={styles.ghost}>{art}</View>}
        {art}
        <View style={styles.glareClip}>
          <Animated.View style={[styles.glare, { opacity: glare }]} />
        </View>
      </Animated.View>
    </View>
  );
}

interface CameraViewfinderProps {
  active: boolean;
  guideWidth: number;
  pose: SubjectPose;
  onToggle: () => void;
  children?: ReactNode;
}

export function CameraViewfinder({ active, guideWidth, pose, onToggle, children }: CameraViewfinderProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const torch = useScannerStore((s) => s.settings.torch);
  const facing = useScannerStore((s) => s.settings.facing);
  const testFeed = useScannerStore((s) => s.settings.testFeed);
  const updateSettings = useScannerStore((s) => s.updateSettings);

  return (
    <View style={styles.root}>
      {permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing={facing} autofocus="off" enableTorch={torch && facing === "back"} active={active} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permission]}>
          <Camera size={28} color={colors.textDim} />
          <Text style={styles.permissionText}>
            {permission?.canAskAgain === false ? "Camera access is off. Enable it in Settings to scan real cards." : "Allow the camera to scan real cards."}
          </Text>
          {permission?.canAskAgain !== false && <Button label="Allow camera" variant="secondary" onPress={() => void requestPermission()} />}
        </View>
      )}

      {testFeed && <SimulatedCard pose={pose} width={guideWidth} />}
      {children}

      <View style={styles.floating}>
        <PressableScale
          style={styles.fab}
          accessibilityLabel="Switch camera"
          onPress={() => {
            onToggle();
            updateSettings({ facing: facing === "back" ? "front" : "back" });
          }}
        >
          <SwitchCamera size={20} color={colors.text} />
        </PressableScale>
        <PressableScale
          style={[styles.fab, testFeed && styles.fabOn]}
          accessibilityLabel={testFeed ? "Turn off test feed" : "Turn on test feed"}
          onPress={() => {
            onToggle();
            updateSettings({ testFeed: !testFeed });
          }}
        >
          <FlaskConical size={20} color={testFeed ? colors.violetBright : colors.text} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  ghost: { position: "absolute", top: 0, left: 0, opacity: 0.35, transform: [{ translateX: 6 }, { translateY: 3 }] },
  glareClip: { ...StyleSheet.absoluteFill, borderRadius: radius.md, overflow: "hidden" },
  glare: { position: "absolute", top: -40, bottom: -40, left: "30%", width: 70, backgroundColor: "rgba(255,255,255,0.85)", transform: [{ rotate: "24deg" }] },
  permission: { alignItems: "center", justifyContent: "center", gap: space(2), padding: space(4), backgroundColor: colors.background },
  permissionText: { ...type.body, color: colors.textMuted, textAlign: "center", maxWidth: 280 },
  floating: { position: "absolute", right: space(2), top: "42%", gap: space(1.5) },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fabOn: { borderColor: "rgba(124, 58, 237, 0.6)", backgroundColor: "rgba(124, 58, 237, 0.22)" },
});
