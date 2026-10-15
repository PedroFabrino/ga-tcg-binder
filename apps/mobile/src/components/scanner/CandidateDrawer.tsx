import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, RotateCcw } from "lucide-react-native";
import { collectorDigits, type Finish, type MatchResult } from "../../types/card";
import { useScannerStore } from "../../store/scannerStore";
import { colors, elementLabels, radius, space, type } from "../../theme";
import { ConfidenceBadge, ElementDot } from "../shared/Badges";
import { Button, FinishToggle, PressableScale } from "../shared/Button";
import { CardArt } from "../shared/CardArt";

function CandidateRow({ match, finish, selected, onPress }: { match: MatchResult; finish: Finish; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.candidate, selected && styles.candidateSelected]} accessibilityLabel={`${match.cardName}, ${Math.round(match.confidence)} percent`}>
      <CardArt
        name={match.cardName}
        element={match.element}
        setPrefix={match.setPrefix}
        collectorNumber={match.collectorNumber}
        imageUrl={match.imageUrl}
        finish={selected ? finish : "Normal"}
        size="sm"
      />
      <View style={styles.candidateInfo}>
        <Text style={styles.candidateName} numberOfLines={1}>
          {match.cardName}
        </Text>
        <View style={styles.metaRow}>
          <ElementDot element={match.element} />
          <Text style={styles.meta}>{elementLabels[match.element]}</Text>
          <Text style={styles.metaMono}>
            {match.setPrefix} · {collectorDigits(match.setPrefix, match.collectorNumber)}
          </Text>
        </View>
        <ConfidenceBadge value={match.confidence} />
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <Check size={13} color={colors.background} />}</View>
    </PressableScale>
  );
}

/** Low-confidence match: the scanner keeps running while the user picks from the top three. */
export function CandidateDrawer({ onTap }: { onTap: () => void }) {
  const candidates = useScannerStore((s) => s.candidates);
  const selectCandidate = useScannerStore((s) => s.selectCandidate);
  const dismissCandidates = useScannerStore((s) => s.dismissCandidates);
  const [shown, setShown] = useState<MatchResult[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finish, setFinish] = useState<Finish>("Normal");
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (candidates) {
      setShown(candidates);
      setSelectedId(candidates[0]?.editionId ?? null);
      setFinish("Normal");
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
    } else {
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => finished && setShown(null));
    }
  }, [candidates, slide]);

  if (!shown) return null;
  const selected = shown.find((c) => c.editionId === selectedId) ?? shown[0];
  const interactive = !!candidates;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={interactive ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissCandidates} accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Which card is this?</Text>
        <Text style={styles.subtitle}>We're not fully sure. Pick the right match below.</Text>

        <View style={styles.list}>
          {shown.map((match) => (
            <CandidateRow
              key={match.editionId}
              match={match}
              finish={finish}
              selected={match.editionId === selected?.editionId}
              onPress={() => {
                onTap();
                setSelectedId(match.editionId);
              }}
            />
          ))}
        </View>

        <View style={styles.finishRow}>
          <Text style={styles.finishLabel}>Finish</Text>
          <FinishToggle
            value={finish}
            onChange={(f) => {
              onTap();
              setFinish(f);
            }}
          />
        </View>

        <View style={styles.actions}>
          <Button label="Rescan" variant="ghost" icon={<RotateCcw size={16} color={colors.text} />} onPress={dismissCandidates} />
          <Button label="Select This Card" style={styles.primary} disabled={!selected} onPress={() => selected && selectCandidate(selected, finish)} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(2.5),
    paddingBottom: space(3),
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space(2) },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: 4 },
  list: { gap: space(1), marginTop: space(2) },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
    padding: space(1.25),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  candidateSelected: { borderColor: colors.emerald, backgroundColor: colors.emeraldSoft },
  candidateInfo: { flex: 1, gap: 4, alignItems: "flex-start" },
  candidateName: { ...type.bodyStrong, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: 12, lineHeight: 16, color: colors.textMuted },
  metaMono: { fontSize: 12, lineHeight: 16, color: colors.textDim, ...type.mono },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  finishRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space(2) },
  finishLabel: { ...type.bodyStrong, color: colors.textMuted },
  actions: { flexDirection: "row", gap: space(1), marginTop: space(2.5) },
  primary: { flex: 1 },
});
