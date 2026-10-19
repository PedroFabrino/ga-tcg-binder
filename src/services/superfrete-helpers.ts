import type { SuperfreteCalculatorQuote, SuperfretePackageDimensions } from "./superfrete-client";

export interface SuperfreteProductLine {
  name: string;
  quantity: number;
  unitary_value: number;
}

export type ShippingPackagePreset = "standard-box" | "bubble-mailer" | "deck-box" | "custom";

export interface ShippingPackageConfig {
  preset?: ShippingPackagePreset;
  heightCm?: number;
  widthCm?: number;
  lengthCm?: number;
  baseWeightG?: number;
  tapeWeightG?: number;
  cardWeightG?: number;
}

export const SHIPPING_PACKAGE_PRESETS: Record<
  Exclude<ShippingPackagePreset, "custom">,
  Required<Omit<ShippingPackageConfig, "preset">>
> = {
  "standard-box": {
    heightCm: 2,
    widthCm: 21,
    lengthCm: 30,
    baseWeightG: 200,
    tapeWeightG: 5,
    cardWeightG: 3,
  },
  "bubble-mailer": {
    heightCm: 2,
    widthCm: 15,
    lengthCm: 20,
    baseWeightG: 50,
    tapeWeightG: 5,
    cardWeightG: 3,
  },
  "deck-box": {
    heightCm: 5,
    widthCm: 15,
    lengthCm: 20,
    baseWeightG: 150,
    tapeWeightG: 10,
    cardWeightG: 3,
  },
};

export const DEFAULT_SHIPPING_PACKAGE_CONFIG: Required<ShippingPackageConfig> = {
  preset: "standard-box",
  ...SHIPPING_PACKAGE_PRESETS["standard-box"],
};

export function calculatePackageWeightKg(
  totalCards: number,
  config?: ShippingPackageConfig
): number {
  const cards = Math.max(1, totalCards || 1);
  const baseWeight = config?.baseWeightG ?? DEFAULT_SHIPPING_PACKAGE_CONFIG.baseWeightG;
  const tapeWeight = config?.tapeWeightG ?? DEFAULT_SHIPPING_PACKAGE_CONFIG.tapeWeightG;
  const cardWeight = config?.cardWeightG ?? DEFAULT_SHIPPING_PACKAGE_CONFIG.cardWeightG;
  const totalGrams = baseWeight + tapeWeight + cards * cardWeight;
  return Number((totalGrams / 1000).toFixed(3));
}

export function buildPackageVolume(
  totalCards: number = 1,
  config?: ShippingPackageConfig
): SuperfretePackageDimensions {
  const weight = calculatePackageWeightKg(totalCards, config);
  return {
    height: config?.heightCm ?? DEFAULT_SHIPPING_PACKAGE_CONFIG.heightCm,
    width: config?.widthCm ?? DEFAULT_SHIPPING_PACKAGE_CONFIG.widthCm,
    length: config?.lengthCm ?? DEFAULT_SHIPPING_PACKAGE_CONFIG.lengthCm,
    weight,
  };
}

export function sanitizeName(name: string, fallback: string): string {
  const trimmed = (name || "").trim().slice(0, 50);
  if (!trimmed) return fallback;
  if (!trimmed.includes(" ")) {
    return `${trimmed} Colecionador`.slice(0, 50);
  }
  return trimmed;
}

export function toCarrierCode(
  serviceId: number | string,
  companyName?: string
): "loggi" | "jadlog" | "correios" | "outro" {
  const idStr = String(serviceId);
  const comp = (companyName || "").toLowerCase();
  if (idStr === "31" || comp.includes("loggi")) return "loggi";
  if (idStr === "3" || comp.includes("jadlog")) return "jadlog";
  if (idStr === "1" || idStr === "2" || idStr === "17" || comp.includes("correios")) {
    return "correios";
  }
  return "outro";
}

export function calculateInsuranceValue(
  subtotalCents: number,
  shippingCents: number,
  serviceCode?: string | number
): number {
  const rawBrl = Number(((subtotalCents + shippingCents) / 100).toFixed(2));
  const sCode = serviceCode !== undefined ? String(serviceCode) : undefined;

  if (sCode === "1" || sCode === "2") {
    return Math.max(rawBrl, 24.5);
  }
  if (sCode === "17") {
    return Math.max(rawBrl, 12.25);
  }
  if (sCode === "3" || sCode === "31") {
    return Math.max(rawBrl, 1.0);
  }

  return Math.max(rawBrl, 24.5);
}

export function quotePrice(q: SuperfreteCalculatorQuote): number {
  return typeof q.price === "number" ? q.price : parseFloat(String(q.price)) || 0;
}

export const quotePriceAscending = (
  a: SuperfreteCalculatorQuote,
  b: SuperfreteCalculatorQuote
): number => quotePrice(a) - quotePrice(b);

export function selectBestCarrierQuote(
  quotes: SuperfreteCalculatorQuote[]
): SuperfreteCalculatorQuote | null {
  const validQuotes = quotes.filter((q) => {
    if (q.has_error) return false;
    const priceNum = quotePrice(q);
    return !isNaN(priceNum) && priceNum > 0;
  });

  if (validQuotes.length === 0) return null;

  // 1. Preferred group: Loggi (31) and Jadlog (3)
  const preferred = validQuotes.filter((q) => {
    const carrier = toCarrierCode(q.id, q.company?.name);
    return carrier === "loggi" || carrier === "jadlog";
  });

  if (preferred.length > 0) {
    preferred.sort(quotePriceAscending);
    return preferred[0];
  }

  // 2. Fallback group: Correios (1, 2, 17)
  const fallback = validQuotes.filter((q) => {
    const carrier = toCarrierCode(q.id, q.company?.name);
    return carrier === "correios";
  });

  if (fallback.length > 0) {
    fallback.sort(quotePriceAscending);
    return fallback[0];
  }

  validQuotes.sort(quotePriceAscending);
  return validQuotes[0];
}

export function buildSuperfreteProducts(
  items: Array<{ cardName: string; quantity: number }>,
  insuranceBrl: number
): SuperfreteProductLine[] {
  const totalCents = Math.round(insuranceBrl * 100);

  if (!items || items.length === 0) {
    return [
      {
        name: "Cards Colecionáveis Grand Archive",
        quantity: 1,
        unitary_value: Number((totalCents / 100).toFixed(2)),
      },
    ];
  }

  const units: string[] = [];
  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1);
    for (let i = 0; i < qty; i++) {
      units.push(item.cardName || "Card Grand Archive");
    }
  }

  if (units.length === 0) {
    return [
      {
        name: "Cards Colecionáveis Grand Archive",
        quantity: 1,
        unitary_value: Number((totalCents / 100).toFixed(2)),
      },
    ];
  }

  const totalCount = units.length;
  const baseCentsPerUnit = Math.floor(totalCents / totalCount);
  const remainderCents = totalCents % totalCount;

  const unitCents: number[] = [];
  for (let i = 0; i < totalCount; i++) {
    unitCents.push(baseCentsPerUnit + (i < remainderCents ? 1 : 0));
  }

  const grouped = new Map<string, { name: string; quantity: number; unitCents: number }>();
  for (let i = 0; i < totalCount; i++) {
    const name = units[i];
    const cents = unitCents[i];
    const key = `${name}:::${cents}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      grouped.set(key, { name, quantity: 1, unitCents: cents });
    }
  }

  return Array.from(grouped.values()).map((g) => ({
    name: g.name,
    quantity: g.quantity,
    unitary_value: Number((g.unitCents / 100).toFixed(2)),
  }));
}
