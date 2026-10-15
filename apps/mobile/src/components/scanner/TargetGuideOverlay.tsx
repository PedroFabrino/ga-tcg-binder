import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";

const BRACKET = 34;
const STROKE = 4;
const MASK = 2000;

/** 2.5:3.5 card guide; brackets breathe outward while seeking and snap inward on lock. */
export function TargetGuideOverlay({ width, locked }: { width: number; locked: boolean }) {
  const height = (width * 3.5) / 2.5;
  const spread = useRef(new Animated.Value(10)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (locked) {
      Animated.parallel([
        Animated.spring(spread, { toValue: -6, useNativeDriver: true, speed: 22, bounciness: 10 }),
        Animated.timing(glow, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.timing(glow, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(spread, { toValue: 14, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(spread, { toValue: 6, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [locked, spread, glow]);

  const out = spread;
  const inward = Animated.multiply(spread, -1);
  const corners = [
    { key: "tl", style: cornerStyles.tl, x: inward, y: inward },
    { key: "tr", style: cornerStyles.tr, x: out, y: inward },
    { key: "bl", style: cornerStyles.bl, x: inward, y: out },
    { key: "br", style: cornerStyles.br, x: out, y: out },
  ] as const;

  return (
    <View pointerEvents="none" style={styles.center}>
      <View style={{ width, height }}>
        <View style={[styles.mask, { width: width + MASK * 2, height: height + MASK * 2, left: -MASK, top: -MASK }]} />
        <Animated.View style={[styles.lockedFrame, { opacity: glow }]} />
        {corners.map((c) => (
          <Animated.View key={c.key} style={[styles.bracket, c.style, { transform: [{ translateX: c.x }, { translateY: c.y }] }]} />
        ))}
      </View>
    </View>
  );
}

const cornerStyles = StyleSheet.create({
  tl: { top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: radius.lg },
  tr: { top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: radius.lg },
  bl: { bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: radius.lg },
  br: { bottom: 0, right: 0, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: radius.lg },
});

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  mask: { position: "absolute", borderWidth: MASK, borderColor: "rgba(9, 9, 11, 0.58)", borderRadius: MASK + radius.lg },
  lockedFrame: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.emeraldBright,
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    shadowColor: colors.emerald,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  bracket: {
    position: "absolute",
    width: BRACKET,
    height: BRACKET,
    borderColor: colors.emeraldBright,
    shadowColor: colors.emerald,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
