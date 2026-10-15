import { StyleSheet, Text, View } from "react-native";
import type { ElementKey } from "../../types/card";
import { colors, elementColors, elementLabels, radius, space, type } from "../../theme";

export function ElementDot({ element, size = 8 }: { element: ElementKey; size?: number }) {
  return <View accessibilityLabel={elementLabels[element]} style={{ width: size, height: size, borderRadius: size, backgroundColor: elementColors[element] }} />;
}

export function ComingSoonBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.badge, compact && styles.compact]}>
      <Text style={[styles.text, compact && styles.compactText]}>{compact ? "SOON" : "COMING SOON"}</Text>
    </View>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const tone = value >= 90 ? colors.emerald : value >= 75 ? colors.amber : colors.red;
  return (
    <View style={[styles.confidence, { borderColor: `${tone}66`, backgroundColor: `${tone}1f` }]}>
      <Text style={[styles.confidenceText, { color: tone }]}>{Math.round(value)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: space(1),
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.violetSoft,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.45)",
    alignSelf: "flex-start",
  },
  compact: { paddingHorizontal: 5, paddingVertical: 1 },
  text: { ...type.caption, color: colors.violetBright },
  compactText: { fontSize: 8, lineHeight: 11, letterSpacing: 0.6 },
  confidence: { paddingHorizontal: space(1), paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1 },
  confidenceText: { ...type.caption, ...type.mono, letterSpacing: 0 },
});
