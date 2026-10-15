import { memo } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ElementKey, Finish } from "../../types/card";
import { colors, elementColors, elementLabels, radius } from "../../theme";

interface CardArtProps {
  name: string;
  element: ElementKey;
  setPrefix: string;
  collectorNumber: string;
  imageUrl: string | null;
  finish?: Finish;
  size?: "xs" | "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

const WIDTHS = { xs: 36, sm: 52, md: 96, lg: 200 } as const;

/** Card face: the real scan when available, otherwise a typeset element frame. */
export const CardArt = memo(function CardArt({ name, element, setPrefix, collectorNumber, imageUrl, finish = "Normal", size = "md", style }: CardArtProps) {
  const width = WIDTHS[size];
  const height = width * 1.4;
  const tint = elementColors[element];
  const compact = size === "xs" || size === "sm";
  const footerSize = size === "lg" ? 11 : 8;

  return (
    <View style={[styles.frame, { width, height, borderRadius: compact ? radius.sm : radius.md, borderColor: `${tint}66` }, style]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `${tint}22` }]} />
          <View style={[styles.orb, { backgroundColor: `${tint}40`, width: width * 1.1, height: width * 1.1, borderRadius: width, top: -width * 0.35, right: -width * 0.45 }]} />
          <View style={[styles.window, { top: "16%", height: "42%", borderColor: `${tint}55`, backgroundColor: `${tint}18` }]}>
            <View style={[styles.sigil, { borderColor: tint, width: "22%", aspectRatio: 1 }]} />
          </View>
          {!compact && (
            <>
              <Text numberOfLines={1} style={[styles.name, { fontSize: size === "lg" ? 16 : 10 }]}>
                {name}
              </Text>
              <View style={styles.footer}>
                <Text style={[styles.footerText, { fontSize: footerSize }]}>{elementLabels[element].toUpperCase()}</Text>
                <Text style={[styles.footerText, { fontSize: footerSize }]}>
                  {setPrefix} {collectorNumber}
                </Text>
              </View>
            </>
          )}
        </>
      )}
      {finish === "Foil" && <View pointerEvents="none" style={styles.foil} />}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1 },
  orb: { position: "absolute" },
  window: { position: "absolute", left: "8%", right: "8%", borderWidth: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  sigil: { borderWidth: 1.5, borderRadius: 999, transform: [{ rotate: "45deg" }] },
  name: { position: "absolute", top: "4%", left: "8%", right: "8%", color: colors.text, fontWeight: "600" },
  footer: { position: "absolute", bottom: "5%", left: "8%", right: "8%", flexDirection: "row", justifyContent: "space-between" },
  footerText: { color: colors.textMuted, fontWeight: "600", letterSpacing: 0.6 },
  foil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(167, 139, 250, 0.16)", borderWidth: 1, borderColor: "rgba(250, 250, 250, 0.35)" },
});
