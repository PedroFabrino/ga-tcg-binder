import { StyleSheet, Text, View } from "react-native";
import { BookOpen, Plus } from "lucide-react-native";
import { MOCK_CARDS } from "../../lib/mockCards";
import type { ElementKey, Finish } from "../../types/card";
import { colors, elementColors, elementLabels, radius, space, type } from "../../theme";
import { CardArt } from "../shared/CardArt";
import { PreviewCard, SuitePreview } from "./SuitePreview";

const STATS = [
  { label: "Cards", value: "1,284" },
  { label: "Unique", value: "412" },
  { label: "Foils", value: "86" },
  { label: "DOA set", value: "62%" },
];

const FILTERS: ElementKey[] = ["FIRE", "WATER", "WIND", "EARTH", "LUXEM", "UMBRA"];

type Pocket = { index: number; finish: Finish; qty: number } | null;
const POCKETS: Pocket[] = [
  { index: 0, finish: "Normal", qty: 1 },
  { index: 1, finish: "Foil", qty: 1 },
  { index: 2, finish: "Normal", qty: 3 },
  null,
  { index: 3, finish: "Normal", qty: 2 },
  { index: 4, finish: "Foil", qty: 1 },
  { index: 5, finish: "Normal", qty: 1 },
  { index: 6, finish: "Normal", qty: 4 },
  null,
];

function PocketSlot({ pocket }: { pocket: Pocket }) {
  const card = pocket ? MOCK_CARDS[pocket.index % MOCK_CARDS.length] : undefined;
  const edition = card?.editions[0];
  if (!pocket || !card || !edition) {
    return (
      <View style={[styles.pocket, styles.empty]}>
        <Plus size={16} color={colors.textDim} />
        <Text style={styles.missing}>Missing</Text>
      </View>
    );
  }
  return (
    <View style={styles.pocket}>
      <CardArt
        name={card.name}
        element={card.element}
        setPrefix={edition.setPrefix}
        collectorNumber={edition.collectorNumber}
        imageUrl={edition.imageUrl}
        finish={pocket.finish}
        size="md"
        style={styles.art}
      />
      {pocket.qty > 1 && (
        <View style={styles.qty}>
          <Text style={styles.qtyText}>x{pocket.qty}</Text>
        </View>
      )}
    </View>
  );
}

export function BinderPreview() {
  return (
    <SuitePreview icon={BookOpen} title="Binder" description="Your whole collection, page by page, synced from every scan.">
      <View style={styles.stats}>
        {STATS.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.filters}>
        <View style={[styles.chip, styles.chipActive]}>
          <Text style={[styles.chipText, { color: colors.text }]}>All</Text>
        </View>
        {FILTERS.map((el) => (
          <View key={el} style={styles.chip}>
            <View style={[styles.chipDot, { backgroundColor: elementColors[el] }]} />
            <Text style={styles.chipText}>{elementLabels[el]}</Text>
          </View>
        ))}
      </View>

      <PreviewCard>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Dawn of Ashes</Text>
          <Text style={styles.pageNumber}>PAGE 3 / 24</Text>
        </View>
        <View style={styles.grid}>
          {POCKETS.map((p, i) => (
            <PocketSlot key={i} pocket={p} />
          ))}
        </View>
        <View style={styles.pager}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.pagerDot, i === 2 && styles.pagerDotActive]} />
          ))}
        </View>
      </PreviewCard>
    </SuitePreview>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: space(1) },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: space(1.5), alignItems: "center" },
  statValue: { ...type.title, ...type.mono, color: colors.text },
  statLabel: { fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: space(0.75) },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space(1.25), paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: colors.textMuted },
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: space(1.5) },
  pageTitle: { ...type.bodyStrong, color: colors.text },
  pageNumber: { ...type.caption, ...type.mono, color: colors.textDim },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space(1) },
  pocket: { width: "31.5%", aspectRatio: 1 / 1.4, borderRadius: radius.md },
  art: { width: "100%", height: "100%" },
  empty: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", gap: 4 },
  missing: { fontSize: 11, lineHeight: 14, color: colors.textDim },
  qty: { position: "absolute", top: 4, right: 4, backgroundColor: colors.scrim, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  qtyText: { fontSize: 10, lineHeight: 14, fontWeight: "600", color: colors.text, ...type.mono },
  pager: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: space(2) },
  pagerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  pagerDotActive: { width: 18, backgroundColor: colors.violetBright },
});
