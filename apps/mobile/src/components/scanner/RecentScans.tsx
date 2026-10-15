import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useScannerStore } from "../../store/scannerStore";
import { colors, radius, space } from "../../theme";
import { ElementDot } from "../shared/Badges";

export function RecentScans() {
  const scanned = useScannerStore((s) => s.scanned);
  const recent = scanned.slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <View style={styles.row}>
      {recent.map((card, i) => (
        <View key={card.id} style={[styles.chip, { opacity: 1 - i * 0.22 }]}>
          <ElementDot element={card.match.element} />
          <Text style={styles.name} numberOfLines={1}>
            {card.match.cardName}
          </Text>
          {card.finish === "Foil" && <Text style={styles.foil}>FOIL</Text>}
          {card.status === "sent" ? <CheckCircle2 size={13} color={colors.emeraldBright} /> : <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space(0.75), justifyContent: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 140,
    paddingHorizontal: space(1.25),
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 12, lineHeight: 16, color: colors.text, flexShrink: 1 },
  foil: { fontSize: 9, lineHeight: 12, fontWeight: "600", letterSpacing: 0.6, color: colors.violetBright },
  spinner: { transform: [{ scale: 0.6 }], width: 13, height: 13 },
});
