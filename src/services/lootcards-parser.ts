/**
 * Parser for Lootcards (https://lootcards.store/) API responses and Astro SSR HTML pages.
 */

export interface ParsedLootcardsCard {
  uuid: string;
  slug: string;
  name: string;
  editionUuid: string;
  setPrefix: string;
  collectorNumber: string;
  rarity: number;
  rarityCode: string;
  imageUrl: string;
  minPriceCents: number;
  priceNumeric: number;
  price: string;
  totalStock: number;
  hasStock: boolean;
  hasFoil: boolean;
  hasCurioFoil: boolean;
}

export interface LootcardsCatalogResponse {
  cards: ParsedLootcardsCard[];
  totalCards: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ParsedLootcardsVariant {
  id: string;
  editionUuid: string;
  finish: "NONFOIL" | "FOIL" | string;
  condition: string;
  language: string;
  priceCents: number;
  priceNumeric: number;
  price: string;
  quantity: number;
  isActive: boolean;
}

export function formatBrlPrice(priceCents: number): string {
  const numeric = Math.max(0, priceCents) / 100;
  return `R$ ${numeric.toFixed(2).replace(".", ",")}`;
}

export function parseLootcardsCatalogResponse(input: unknown): LootcardsCatalogResponse {
  const fallback: LootcardsCatalogResponse = {
    cards: [],
    totalCards: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 24,
  };

  if (!input) {
    return fallback;
  }

  let data: any = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      return fallback;
    }
  }

  if (!data || typeof data !== "object") {
    return fallback;
  }

  const rawCards = Array.isArray(data.cards) ? data.cards : [];
  const cards: ParsedLootcardsCard[] = rawCards
    .map((c: any): ParsedLootcardsCard | null => {
      if (!c || typeof c !== "object") return null;

      const editionUuid = String(c.edition_uuid ?? "").trim();
      const slug = String(c.slug ?? "").trim();
      const name = String(c.name ?? "").trim();

      if (!editionUuid && !slug && !name) {
        return null;
      }

      const minPriceCents = typeof c.min_price_cents === "number" ? c.min_price_cents : 0;
      const priceNumeric = minPriceCents / 100;
      const totalStock = typeof c.total_stock === "number" ? c.total_stock : 0;

      return {
        uuid: String(c.uuid ?? ""),
        slug,
        name,
        editionUuid,
        setPrefix: String(c.set_prefix ?? "").trim(),
        collectorNumber: String(c.collector_number ?? "").trim(),
        rarity: typeof c.rarity === "number" ? c.rarity : 0,
        rarityCode: String(c.rarity_code ?? "").trim(),
        imageUrl: String(c.image_url ?? "").trim(),
        minPriceCents,
        priceNumeric,
        price: formatBrlPrice(minPriceCents),
        totalStock,
        hasStock: Boolean(c.has_stock ?? (totalStock > 0)),
        hasFoil: Boolean(c.has_foil),
        hasCurioFoil: Boolean(c.has_curio_foil),
      };
    })
    .filter((c: ParsedLootcardsCard | null): c is ParsedLootcardsCard => c !== null);

  return {
    cards,
    totalCards: typeof data.totalCards === "number" ? data.totalCards : cards.length,
    totalPages: typeof data.totalPages === "number" ? data.totalPages : 1,
    currentPage: typeof data.currentPage === "number" ? data.currentPage : 1,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : 24,
  };
}

export function parseLootcardsTotalCount(jsonOrString: unknown): number | null {
  if (!jsonOrString) return null;

  let obj: any = jsonOrString;
  if (typeof jsonOrString === "string") {
    try {
      obj = JSON.parse(jsonOrString);
    } catch {
      return null;
    }
  }

  if (obj && typeof obj.totalCards === "number") {
    return obj.totalCards;
  }

  return null;
}

export function parseLootcardsLatestCardRefId(jsonOrString: unknown): string | null {
  if (!jsonOrString) return null;

  let obj: any = jsonOrString;
  if (typeof jsonOrString === "string") {
    try {
      obj = JSON.parse(jsonOrString);
    } catch {
      return null;
    }
  }

  if (obj && Array.isArray(obj.cards) && obj.cards.length > 0) {
    const first = obj.cards[0];
    if (first && first.edition_uuid) {
      const priceCents = typeof first.min_price_cents === "number" ? first.min_price_cents : 0;
      return `${first.edition_uuid}:${priceCents}`;
    }
  }

  return null;
}

export function unwrapAstroProps(val: unknown): any {
  if (!Array.isArray(val)) {
    if (val && typeof val === "object") {
      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        res[k] = unwrapAstroProps(v);
      }
      return res;
    }
    return val;
  }

  const [type, data] = val;
  if (type === 0) {
    return unwrapAstroProps(data);
  }
  if (type === 1 && Array.isArray(data)) {
    return data.map(unwrapAstroProps);
  }

  return data ?? val;
}

export function parseLootcardsDetailHtml(html: string): {
  cardName?: string;
  cardSlug?: string;
  variants: ParsedLootcardsVariant[];
} {
  const fallback = { variants: [] };
  if (!html || typeof html !== "string") {
    return fallback;
  }

  const islandMatch = html.match(/<astro-island[^>]+CardPurchasePanel[^>]+props="([^"]+)"/);
  if (!islandMatch?.[1]) {
    return fallback;
  }

  let rawProps: any;
  try {
    const unescaped = islandMatch[1].replace(/&quot;/g, '"');
    rawProps = JSON.parse(unescaped);
  } catch {
    return fallback;
  }

  const unwrapped = unwrapAstroProps(rawProps);
  const cardName = typeof unwrapped.cardName === "string" ? unwrapped.cardName : undefined;
  const cardSlug = typeof unwrapped.cardSlug === "string" ? unwrapped.cardSlug : undefined;

  const variants: ParsedLootcardsVariant[] = [];
  const editions = Array.isArray(unwrapped.editions) ? unwrapped.editions : [];

  for (const ed of editions) {
    const edUuid = String(ed?.uuid ?? ed?.edition_uuid ?? "").trim();
    const edVariants = Array.isArray(ed?.variants) ? ed.variants : [];

    for (const v of edVariants) {
      if (!v) continue;

      const isActive = v.is_active === 1 || v.is_active === true;
      const quantity = typeof v.quantity === "number" ? v.quantity : 0;

      if (!isActive || quantity <= 0) {
        continue;
      }

      const priceCents = typeof v.price_cents === "number" ? v.price_cents : 0;
      const priceNumeric = priceCents / 100;
      const variantId = String(v.id ?? `${edUuid}-${v.finish || "NONFOIL"}-${v.condition || "NM"}`);

      variants.push({
        id: variantId,
        editionUuid: edUuid,
        finish: String(v.finish ?? "NONFOIL").toUpperCase(),
        condition: String(v.condition ?? "NM").toUpperCase(),
        language: String(v.language ?? "EN").toUpperCase(),
        priceCents,
        priceNumeric,
        price: formatBrlPrice(priceCents),
        quantity,
        isActive,
      });
    }
  }

  return {
    cardName,
    cardSlug,
    variants,
  };
}
