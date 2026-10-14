export const ELEMENT_COLORS: Record<string, string> = {
  NORM: "#94a3b8",
  FIRE: "#f43f5e",
  WATER: "#06b6d4",
  WIND: "#10b981",
  EARTH: "#f59e0b",
};

export const ELEMENT_CLASS_MAP: Record<string, string> = {
  NORM: "el-norm",
  FIRE: "el-fire",
  WATER: "el-water",
  WIND: "el-wind",
  EARTH: "el-earth",
};

export function getElementColor(element: string): string {
  return ELEMENT_COLORS[element?.toUpperCase()] || ELEMENT_COLORS.NORM;
}

export function getElementClass(element: string): string {
  return ELEMENT_CLASS_MAP[element?.toUpperCase()] || "el-norm";
}

export function formatPopulation(pop: number): string {
  if (pop <= 0 || pop >= 999999) return "N/A";
  return pop.toLocaleString();
}

export function isLowPop(pop: number, threshold: number = 1000): boolean {
  return pop > 0 && pop <= threshold;
}
