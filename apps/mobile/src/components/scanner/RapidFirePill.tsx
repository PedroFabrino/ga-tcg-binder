import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { RAPID_FIRE_WINDOW_MS, collectorDigits } from "../../types/card";
import { useScannerStore } from "../../store/scannerStore";
import { colors, radius, space, type } from "../../theme";
import { ElementDot } from "../shared/Badges";
import { FinishToggle, PressableScale } from "../shared/Button";
import { CardArt } from "../shared/CardArt";

/** High-confidence match: auto-confirms when the bar fills; the camera keeps running underneath. */
export function RapidFirePill({ onTap }: { onTap: () => void }) {
  const pending = useScannerStore((s) => s.pending);
  const toggleFinish = useScannerStore((s) => s.toggleFinish);
  const confirmPending = useScannerStore((s) => s.confirmPending);
  const cancelPending = useScannerStore((s) => s.cancelPending);
  const enter = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const startedAt = pending?.startedAt;
  const finish = pending?.finish;

  useEffect(() => {
    if (startedAt === undefined) return;
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
  }, [startedAt, enter]);

  useEffect(() => {
    if (startedAt === undefined) return;
    progress.setValue(0);
    const run = Animated.timing(progress, { toValue: 1, duration: RAPID_FIRE_WINDOW_MS, easing: Easing.linear, useNativeDriver: true });
    run.start(({ finished }) => finished && confirmPending());
    return () => run.stop();
  }, [startedAt, finish, progress, confirmPending]);

  if (!pending) return null;
  const { match } = pending;

  return (
    <Animated.View
      style={[
        styles.root,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
      ]}
    >
      <View style={styles.row}>
        <CardArt
          name={match.cardName}
          element={match.element}
          setPrefix={match.setPrefix}
          collectorNumber={match.collectorNumber}
          imageUrl={match.imageUrl}
          finish={pending.finish}
          size="sm"
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {match.cardName}
          </Text>
          <View style={styles.metaRow}>
            <ElementDot element={match.element} />
            <Text style={styles.meta}>
              {match.setPrefix} · {collectorDigits(match.setPrefix, match.collectorNumber)}
            </Text>
            <Text style={styles.confidence}>{Math.round(match.confidence)}%</Text>
          </View>
          <FinishToggle
            value={pending.finish}
            onChange={() => {
              onTap();
              toggleFinish();
            }}
          />
        </View>
        <View style={styles.actions}>
          <PressableScale
            onPress={() => {
              onTap();
              cancelPending();
            }}
            style={styles.cancel}
            accessibilityLabel="Cancel this match"
            hitSlop={6}
          >
            <X size={16} color={colors.textMuted} />
          </PressableScale>
          <PressableScale onPress={confirmPending} style={styles.confirm} accessibilityLabel="Confirm now">
            <Check size={15} color={colors.background} />
            <Text style={styles.confirmText}>Confirm Now</Text>
          </PressableScale>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { transform: [{ scaleX: progress }] }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.4)", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space(1.5), padding: space(1.5) },
  info: { flex: 1, gap: 6 },
  name: { ...type.bodyStrong, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: 12, lineHeight: 16, color: colors.textMuted, ...type.mono },
  confidence: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: colors.emeraldBright, ...type.mono },
  actions: { alignItems: "flex-end", gap: space(1) },
  cancel: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  confirm: { flexDirection: "row", alignItems: "center", gap: 4, height: 36, paddingHorizontal: space(1.5), borderRadius: radius.pill, backgroundColor: colors.emerald },
  confirmText: { fontSize: 13, lineHeight: 16, fontWeight: "600", color: colors.background },
  track: { height: 3, backgroundColor: colors.border },
  bar: { height: 3, backgroundColor: colors.emeraldBright, transformOrigin: "left" },
});
