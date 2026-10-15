import { useRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Finish } from "../../types/card";
import { colors, radius, space, type } from "../../theme";

/** Pressable with a spring scale-down, used for every tappable surface. */
export function PressableScale({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  hitSlop,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  hitSlop?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.95)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && styles.disabled]}>{children}</Animated.View>
    </Pressable>
  );
}

type Variant = "primary" | "brand" | "secondary" | "ghost";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={[styles.button, variantStyles[variant], style]} accessibilityLabel={label}>
      <View style={styles.row}>
        {icon}
        <Text style={[styles.label, { color: variant === "primary" ? colors.background : colors.text }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function FinishToggle({ value, onChange }: { value: Finish; onChange: (finish: Finish) => void }) {
  return (
    <View style={styles.toggle} accessibilityRole="radiogroup">
      {(["Normal", "Foil"] as const).map((option) => {
        const active = option === value;
        return (
          <PressableScale
            key={option}
            onPress={() => !active && onChange(option)}
            style={[styles.toggleOption, active && (option === "Foil" ? styles.toggleFoil : styles.toggleActive)]}
            accessibilityLabel={`${option} finish`}
          >
            <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{option}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.emerald },
  brand: { backgroundColor: colors.violet },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: "transparent" },
});

const styles = StyleSheet.create({
  button: { height: 48, borderRadius: radius.md, paddingHorizontal: space(2.5), alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space(1) },
  label: { ...type.bodyStrong },
  disabled: { opacity: 0.45 },
  toggle: { flexDirection: "row", alignSelf: "flex-start", backgroundColor: colors.background, borderRadius: radius.pill, padding: 2, borderWidth: 1, borderColor: colors.border },
  toggleOption: { paddingHorizontal: space(1.5), paddingVertical: 4, borderRadius: radius.pill },
  toggleActive: { backgroundColor: colors.surfaceRaised },
  toggleFoil: { backgroundColor: colors.violet },
  toggleText: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: colors.textDim },
  toggleTextActive: { color: colors.text },
});
