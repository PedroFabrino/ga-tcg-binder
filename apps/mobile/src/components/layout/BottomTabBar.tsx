import { StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BookOpen, ScanLine, Swords, Trophy, Users, type LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "../../lib/feedback";
import { colors, space } from "../../theme";
import { ComingSoonBadge } from "../shared/Badges";
import { PressableScale } from "../shared/Button";

export type TabName = "Scanner" | "Binder" | "Decks" | "Meta" | "Friends";

const TABS: Record<TabName, { icon: LucideIcon; live: boolean }> = {
  Scanner: { icon: ScanLine, live: true },
  Binder: { icon: BookOpen, live: false },
  Decks: { icon: Swords, live: false },
  Meta: { icon: Trophy, live: false },
  Friends: { icon: Users, live: false },
};

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space(1)) }]}>
      {state.routes.map((route, index) => {
        const name = route.name as TabName;
        const tabInfo = TABS[name];
        if (!tabInfo) return null;
        const { icon: Icon, live } = tabInfo;
        const focused = state.index === index;
        const accent = live ? colors.emeraldBright : colors.violetBright;
        const tint = focused ? accent : live ? colors.textMuted : colors.textDim;

        return (
          <PressableScale
            key={route.key}
            style={styles.tab}
            accessibilityLabel={live ? name : `${name}, coming soon`}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (focused || event.defaultPrevented) return;
              feedback.tap();
              navigation.navigate(route.name);
            }}
          >
            <View style={[styles.pip, { backgroundColor: focused ? accent : "transparent" }]} />
            <View>
              <Icon size={22} color={tint} />
              {!live && (
                <View style={styles.soon}>
                  <ComingSoonBadge compact />
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: tint }]}>{name}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space(0.5) },
  tab: { flex: 1, alignItems: "center", gap: 4, paddingTop: space(0.5) },
  pip: { width: 18, height: 3, borderRadius: 2, marginBottom: 2 },
  soon: { position: "absolute", top: -8, left: 14 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
});
