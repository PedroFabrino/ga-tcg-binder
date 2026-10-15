import { StyleSheet, Text, View } from "react-native";
import { Aperture, Move, Sun, type LucideIcon } from "lucide-react-native";
import { toHudVerdict, verdictHint, type HudVerdict } from "../../lib/qualityGate";
import type { QualityGateConfig, ScanFrameMetrics } from "../../types/session";
import { colors, radius, space, type } from "../../theme";

const VERDICT_TONE: Record<HudVerdict, string> = {
  READY: colors.emerald,
  HOLD: colors.amber,
  GLARE: colors.yellow,
  BLURRY: colors.red,
};

function MetricPill({ icon: Icon, label, ok }: { icon: LucideIcon; label: string; ok: boolean | null }) {
  const tone = ok === null ? colors.textDim : ok ? colors.emeraldBright : colors.amber;
  return (
    <View style={styles.pill}>
      <Icon size={13} color={tone} />
      <Text style={[styles.pillText, { color: ok === null ? colors.textMuted : colors.text }]}>{label}</Text>
    </View>
  );
}

export function QualityGateHUD({ metrics, config, idleHint }: { metrics: ScanFrameMetrics | null; config: QualityGateConfig; idleHint?: string }) {
  const present = !!metrics && metrics.verdict !== "no_card";
  const verdict = metrics ? toHudVerdict(metrics.verdict) : "HOLD";
  const tone = VERDICT_TONE[verdict];
  const hint = metrics ? verdictHint(metrics.verdict) : idleHint ?? "Align a card inside the frame";
  const stable = present && metrics.verdict !== "unstable";

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <MetricPill icon={Aperture} label={present ? `Sharp ${Math.round(metrics.laplacianVariance)}` : "Sharp --"} ok={present ? metrics.laplacianVariance >= config.minSharpness : null} />
        <MetricPill icon={Sun} label={present ? `Glare ${Math.round(metrics.glareRatio * 100)}%` : "Glare --"} ok={present ? metrics.glareRatio <= config.maxGlareRatio : null} />
        <MetricPill
          icon={Move}
          label={!present ? "Stable --" : stable ? `Stable (${metrics.stableFrames}/${config.requiredFrames})` : "Moving"}
          ok={present ? stable : null}
        />
      </View>
      <View style={[styles.verdict, { borderColor: `${tone}66` }]}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <Text style={[styles.verdictText, { color: tone }]}>{verdict}</Text>
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: space(1) },
  row: { flexDirection: "row", gap: space(0.75), flexWrap: "wrap", justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: space(1.25),
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: "600", ...type.mono },
  verdict: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
    paddingHorizontal: space(1.5),
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    maxWidth: "92%",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  verdictText: { ...type.caption },
  hint: { fontSize: 12, lineHeight: 16, color: colors.textMuted, flexShrink: 1 },
});
