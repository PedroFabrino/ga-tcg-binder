import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, type } from "../../theme";
import { ComingSoonBadge } from "../shared/Badges";

/** Frame for not-yet-live features: a header plus a non-interactive preview of the future screen. */
export function SuitePreview({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Icon size={20} color={colors.violetBright} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <ComingSoonBadge />
          </View>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <ScrollView style={styles.preview} contentContainerStyle={styles.content} pointerEvents="none" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

export function PreviewCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space(2) },
  header: { flexDirection: "row", gap: space(1.5), alignItems: "flex-start", marginBottom: space(2.5) },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.violetSoft,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space(1), flexWrap: "wrap" },
  title: { ...type.display, color: colors.text },
  description: { ...type.body, color: colors.textMuted },
  preview: { flex: 1, opacity: 0.88 },
  content: { gap: space(1.5), paddingBottom: space(4) },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space(2) },
});
