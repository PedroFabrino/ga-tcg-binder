export interface RarityConfig {
  id: number;
  label: string;
  color: string;
  activeColor: string;
  bg: string;
  border: string;
  shadow: string;
}

export const RARITIES: RarityConfig[] = [
  {
    id: 1,
    label: "Common",
    color: "#94a3b8",
    activeColor: "#f8fafc",
    bg: "bg-slate-200/20",
    border: "border-slate-200",
    shadow: "shadow-[0_0_12px_rgba(248,250,252,0.4)]",
  },
  {
    id: 2,
    label: "Uncommon",
    color: "#10b981",
    activeColor: "#34d399",
    bg: "bg-emerald-500/20",
    border: "border-emerald-400",
    shadow: "shadow-[0_0_12px_rgba(52,211,153,0.4)]",
  },
  {
    id: 3,
    label: "Rare",
    color: "#06b6d4",
    activeColor: "#22d3ee",
    bg: "bg-cyan-500/20",
    border: "border-cyan-400",
    shadow: "shadow-[0_0_12px_rgba(34,211,238,0.4)]",
  },
  {
    id: 4,
    label: "Super Rare",
    color: "#f59e0b",
    activeColor: "#fbbf24",
    bg: "bg-amber-500/20",
    border: "border-amber-400",
    shadow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]",
  },
  {
    id: 5,
    label: "Ultra Rare",
    color: "#f43f5e",
    activeColor: "#fb7185",
    bg: "bg-rose-500/20",
    border: "border-rose-400",
    shadow: "shadow-[0_0_12px_rgba(251,113,133,0.4)]",
  },
  {
    id: 7,
    label: "Collector",
    color: "#e8c967",
    activeColor: "#fde047",
    bg: "bg-yellow-500/20",
    border: "border-yellow-400",
    shadow: "shadow-[0_0_12px_rgba(253,224,71,0.4)]",
  },
];

export function getRarityLabel(rarity?: number | null): string {
  const match = RARITIES.find((r) => r.id === (rarity || 1));
  return match?.label || "Common";
}
