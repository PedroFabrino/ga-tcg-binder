import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera, SwitchCamera, Zap, ZapOff } from "lucide-react-native";
import { useScannerStore } from "../../store/scannerStore";
import { colors, radius, space, type } from "../../theme";
import { Button, PressableScale } from "../shared/Button";

interface CameraViewfinderProps {
  active: boolean;
  guideWidth: number;
  pose?: any;
  onToggle: () => void;
  children?: ReactNode;
  cameraRef?: React.RefObject<CameraView | null>;
}

export function CameraViewfinder({ active, onToggle, children, cameraRef }: CameraViewfinderProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const torch = useScannerStore((s) => s.settings.torch);
  const facing = useScannerStore((s) => s.settings.facing);
  const updateSettings = useScannerStore((s) => s.updateSettings);

  return (
    <View style={styles.root}>
      {permission?.granted ? (
        <CameraView
          ref={cameraRef as any}
          style={StyleSheet.absoluteFill}
          facing={facing}
          autofocus="on"
          enableTorch={torch && facing === "back"}
          active={active}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permission]}>
          <Camera size={28} color={colors.textDim} />
          <Text style={styles.permissionText}>
            {permission?.canAskAgain === false ? "Camera access is off. Enable it in Settings to scan real cards." : "Allow the camera to scan real cards."}
          </Text>
          {permission?.canAskAgain !== false && <Button label="Allow camera" variant="secondary" onPress={() => void requestPermission()} />}
        </View>
      )}

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

        {facing === "back" && (
          <PressableScale
            style={[styles.fab, torch && styles.fabOn]}
            accessibilityLabel={torch ? "Turn off torch" : "Turn on torch"}
            onPress={() => {
              onToggle();
              updateSettings({ torch: !torch });
            }}
          >
            {torch ? <Zap size={20} color={colors.amber} /> : <ZapOff size={20} color={colors.text} />}
          </PressableScale>
        )}
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
