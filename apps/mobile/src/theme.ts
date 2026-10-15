import { Platform } from "react-native";
import type { ElementKey } from "./types/card";

export const colors = {
  background: "#09090b",
  surface: "#18181b",
  surfaceRaised: "#1f1f23",
  border: "#27272a",
  borderStrong: "#3f3f46",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textDim: "#71717a",
  emerald: "#10b981",
  emeraldBright: "#34d399",
  emeraldSoft: "rgba(16, 185, 129, 0.14)",
  violet: "#7c3aed",
  violetBright: "#a78bfa",
  violetSoft: "rgba(124, 58, 237, 0.16)",
  amber: "#f59e0b",
  amberSoft: "rgba(245, 158, 11, 0.14)",
  yellow: "#facc15",
  yellowSoft: "rgba(250, 204, 21, 0.14)",
  red: "#ef4444",
  redSoft: "rgba(239, 68, 68, 0.14)",
  scrim: "rgba(9, 9, 11, 0.72)",
  glass: "rgba(24, 24, 27, 0.82)",
} as const;

export const elementColors: Record<ElementKey, string> = {
  NORM: "#a1a1aa",
  FIRE: "#ef4444",
  WATER: "#3b82f6",
  WIND: "#10b981",
  EARTH: "#d97706",
  LUXEM: "#facc15",
  UMBRA: "#a855f7",
};

export const elementLabels: Record<ElementKey, string> = {
  NORM: "Normal",
  FIRE: "Fire",
  WATER: "Water",
  WIND: "Wind",
  EARTH: "Earth",
  LUXEM: "Luxem",
  UMBRA: "Umbra",
};

/** 8px spacing scale. */
export const space = (n: number) => n * 8;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const type = {
  caption: { fontSize: 11, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 0.8 },
  body: { fontSize: 14, lineHeight: 21, fontWeight: "400" as const },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  title: { fontSize: 18, lineHeight: 22, fontWeight: "600" as const },
  display: { fontSize: 26, lineHeight: 31, fontWeight: "700" as const },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontVariant: ["tabular-nums" as const] },
};
