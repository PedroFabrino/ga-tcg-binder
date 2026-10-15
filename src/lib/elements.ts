export const ELEMENT_COLORS: Record<string, string> = {
  NORM: "#94a3b8",
  FIRE: "#f43f5e",
  WATER: "#06b6d4",
  WIND: "#10b981",
  TERA: "#d97706",
  EARTH: "#d97706", // Alias for TERA
  CRUX: "#ea580c",
  UMBRA: "#8b5cf6",
  LUXEM: "#eab308",
  LUMEN: "#eab308", // Alias for LUXEM
  EXALTED: "#f59e0b",
  ASTRA: "#6366f1",
  EXIA: "#ec4899",
  ARCANE: "#a855f7",
  ARCANA: "#a855f7", // Alias for ARCANE
  NEOS: "#0ea5e9",
};

export const ELEMENT_CLASS_MAP: Record<string, string> = {
  NORM: "el-norm",
  FIRE: "el-fire",
  WATER: "el-water",
  WIND: "el-wind",
  TERA: "el-tera",
  EARTH: "el-tera",
  CRUX: "el-crux",
  UMBRA: "el-umbra",
  LUXEM: "el-luxem",
  LUMEN: "el-luxem",
  EXALTED: "el-exalted",
  ASTRA: "el-astra",
  EXIA: "el-exia",
  ARCANE: "el-arcane",
  ARCANA: "el-arcane",
  NEOS: "el-neos",
};

export const ELEMENT_LABELS: Record<string, string> = {
  NORM: "Norm",
  FIRE: "Fire",
  WATER: "Water",
  WIND: "Wind",
  TERA: "Tera",
  EARTH: "Earth",
  CRUX: "Crux",
  UMBRA: "Umbra",
  LUXEM: "Luxem",
  LUMEN: "Lumen",
  EXALTED: "Exalted",
  ASTRA: "Astra",
  EXIA: "Exia",
  ARCANE: "Arcane",
  ARCANA: "Arcana",
  NEOS: "Neos",
};

export const ALL_ELEMENTS = [
  "NORM",
  "FIRE",
  "WATER",
  "WIND",
  "TERA",
  "CRUX",
  "UMBRA",
  "LUXEM",
  "EXALTED",
  "ASTRA",
  "EXIA",
  "ARCANE",
  "NEOS",
] as const;

export function normalizeElement(element?: string | null): string {
  if (!element) return "NORM";
  const upper = element.toUpperCase().trim();
  if (upper === "EARTH") return "TERA";
  if (upper === "LUMEN") return "LUXEM";
  if (upper === "ARCANA") return "ARCANE";
  return upper;
}

export function getElementColor(element: string): string {
  const norm = normalizeElement(element);
  return ELEMENT_COLORS[norm] || ELEMENT_COLORS.NORM;
}

export function getElementClass(element: string): string {
  const norm = normalizeElement(element);
  return ELEMENT_CLASS_MAP[norm] || "el-norm";
}

export function formatPopulation(pop: number): string {
  if (pop <= 0 || pop >= 999999) return "N/A";
  return pop.toLocaleString();
}

export function isLowPop(pop: number, threshold: number = 1000): boolean {
  return pop > 0 && pop <= threshold;
}
