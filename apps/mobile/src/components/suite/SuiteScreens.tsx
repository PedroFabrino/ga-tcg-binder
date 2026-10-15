import { StyleSheet, Text, View } from "react-native";
import { Minus, Swords, TrendingDown, TrendingUp, Trophy, Users } from "lucide-react-native";
import type { ElementKey } from "../../types/card";
import { colors, elementColors, radius, space, type } from "../../theme";
import { PreviewCard, SuitePreview } from "./SuitePreview";

const DECKS: { name: string; owned: number; total: number; mix: [ElementKey, number][] }[] = [
  { name: "Ashen Vanguard", owned: 52, total: 60, mix: [["FIRE", 0.6], ["EARTH", 0.3], ["NORM", 0.1]] },
  { name: "Tidecaller Control", owned: 41, total: 60, mix: [["WATER", 0.7], ["LUXEM", 0.2], ["NORM", 0.1]] },
  { name: "Umbral Gambit", owned: 60, total: 60, mix: [["UMBRA", 0.55], ["WIND", 0.35], ["NORM", 0.1]] },
];

function MixBar({ mix }: { mix: [ElementKey, number][] }) {
  return (
    <View style={styles.mix}>
      {mix.map(([el, share]) => (
        <View key={el} style={{ flex: share, backgroundColor: elementColors[el] }} />
      ))}
    </View>
  );
}

export function DecksPreview() {
  return (
    <SuitePreview icon={Swords} title="Decks" description="Build decks from cards you own and see exactly what's missing.">
      {DECKS.map((d) => (
        <PreviewCard key={d.name}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>{d.name}</Text>
            <Text style={[styles.mono, { color: d.owned === d.total ? colors.emeraldBright : colors.textMuted }]}>
              {d.owned}/{d.total}
            </Text>
          </View>
          <MixBar mix={d.mix} />
          <Text style={styles.sub}>{d.owned === d.total ? "Complete - ready to play" : `${d.total - d.owned} cards missing`}</Text>
        </PreviewCard>
      ))}
    </SuitePreview>
  );
}

const ARCHETYPES: { name: string; element: ElementKey; share: number; trend: "up" | "down" | "flat" }[] = [
  { name: "Fire Aggro", element: "FIRE", share: 24, trend: "up" },
  { name: "Water Tempo", element: "WATER", share: 19, trend: "flat" },
  { name: "Umbra Reanimator", element: "UMBRA", share: 16, trend: "up" },
  { name: "Earth Ramp", element: "EARTH", share: 13, trend: "down" },
  { name: "Luxem Midrange", element: "LUXEM", share: 9, trend: "down" },
];

const TREND = {
  up: { Icon: TrendingUp, color: colors.emeraldBright },
  down: { Icon: TrendingDown, color: colors.red },
  flat: { Icon: Minus, color: colors.textDim },
} as const;

export function MetaPreview() {
  return (
    <SuitePreview icon={Trophy} title="Meta" description="What's winning at tournaments this week, by archetype.">
      <PreviewCard>
        <View style={styles.list}>
          {ARCHETYPES.map((a) => {
            const { Icon, color } = TREND[a.trend];
            return (
              <View key={a.name} style={styles.archetype}>
                <View style={styles.rowBetween}>
                  <Text style={styles.name}>{a.name}</Text>
                  <View style={styles.trend}>
                    <Icon size={14} color={color} />
                    <Text style={[styles.mono, { color: colors.text }]}>{a.share}%</Text>
                  </View>
                </View>
                <View style={styles.track}>
                  <View style={{ width: `${(a.share / 24) * 100}%`, height: "100%", borderRadius: 3, backgroundColor: elementColors[a.element] }} />
                </View>
              </View>
            );
          })}
        </View>
      </PreviewCard>
    </SuitePreview>
  );
}

const FRIENDS: { name: string; status: string; online: boolean; trades: number }[] = [
  { name: "Mira K.", status: "Scanning a booster box", online: true, trades: 3 },
  { name: "Theo R.", status: "Last seen 2h ago", online: false, trades: 1 },
  { name: "Ines V.", status: "Building a Wind deck", online: true, trades: 0 },
];

export function FriendsPreview() {
  return (
    <SuitePreview icon={Users} title="Friends" description="Share binders, compare wants, and set up trades.">
      <PreviewCard>
        <Text style={styles.caption}>YOUR FRIEND CODE</Text>
        <Text style={styles.code}>GA-7305</Text>
      </PreviewCard>
      {FRIENDS.map((f) => (
        <PreviewCard key={f.name}>
          <View style={styles.friend}>
            <View style={styles.avatar}>
              <Text style={styles.initial}>{f.name[0]}</Text>
              <View style={[styles.presence, { backgroundColor: f.online ? colors.emerald : colors.borderStrong }]} />
            </View>
            <View style={styles.friendInfo}>
              <Text style={styles.name}>{f.name}</Text>
              <Text style={styles.sub}>{f.status}</Text>
            </View>
            {f.trades > 0 && (
              <View style={styles.tradeBadge}>
                <Text style={styles.tradeText}>{f.trades} trade{f.trades > 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>
        </PreviewCard>
      ))}
    </SuitePreview>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { ...type.bodyStrong, color: colors.text },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: "600", ...type.mono },
  sub: { fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: space(1) },
  mix: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", marginTop: space(1.5), gap: 2 },
  list: { gap: space(2) },
  archetype: { gap: space(1) },
  trend: { flexDirection: "row", alignItems: "center", gap: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
  caption: { ...type.caption, color: colors.textDim },
  code: { fontSize: 24, lineHeight: 29, fontWeight: "700", color: colors.text, marginTop: 4, letterSpacing: 2, ...type.mono },
  friend: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  initial: { ...type.bodyStrong, color: colors.text },
  presence: { position: "absolute", right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.surface },
  friendInfo: { flex: 1 },
  tradeBadge: { paddingHorizontal: space(1), paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.emeraldSoft },
  tradeText: { fontSize: 11, lineHeight: 15, fontWeight: "600", color: colors.emeraldBright },
});
