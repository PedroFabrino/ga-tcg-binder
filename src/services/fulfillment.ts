import {
  RawMypFulfillmentOrderInput,
  RawMypOrderItemInput,
  EnrichedFulfillmentItem,
  PickListEntry,
  BuyerPackGroup,
  BuyerPackSubOrder,
  NonGrandArchiveOrderNotice,
  FulfillmentReport,
  CANONICAL_ELEMENT_ORDER,
  UNMATCHED_ELEMENT,
} from "@ga/contracts";
import {
  findCatalogEditionForFulfillment,
  type CatalogDatabase,
} from "../db/repositories/catalog-repository";
import { normalizeElement, ELEMENT_LABELS } from "../lib/elements";

/**
 * Checks whether an item line belongs to Grand Archive TCG.
 */
export function isGrandArchiveItem(item: RawMypOrderItemInput): boolean {
  const code = (item.mypCode || "").toLowerCase().trim();
  if (code.startsWith("grandarchive_") || code.startsWith("ga_")) return true;
  if (item.productUrl && item.productUrl.toLowerCase().includes("/grandarchive/")) {
    return true;
  }
  return false;
}

/**
 * Extracts the detected TCG name from non-GA item codes or URLs (e.g., "pokemon", "magic").
 */
export function detectNonGaTcg(item: RawMypOrderItemInput): string {
  const code = (item.mypCode || "").toLowerCase().trim();
  const match = code.match(/^([a-z0-9]+)_/);
  if (match && match[1] !== "item") return match[1];

  if (item.productUrl) {
    const parts = item.productUrl.replace(/^\//, "").split("/");
    if (parts[0]) return parts[0].toLowerCase();
  }
  return "other";
}

/**
 * Builds a NonGrandArchiveOrderNotice helper to prevent duplicated object instantiation.
 */
function toNonGaNotice(
  order: RawMypFulfillmentOrderInput,
  nonGaItems: RawMypOrderItemInput[]
): NonGrandArchiveOrderNotice {
  return {
    orderId: order.orderId,
    orderDate: order.orderDate,
    buyerNick: order.buyerNick,
    orderUrl: order.orderUrl,
    detectedTcg: detectNonGaTcg(nonGaItems[0]),
    itemCount: nonGaItems.length,
  };
}

/**
 * Extracts setPrefix and collectorNumber from MyP product code or subtitle.
 */
function extractSetAndCollectorNumber(item: RawMypOrderItemInput): {
  setPrefix: string | null;
  collectorNumber: string | null;
} {
  const code = (item.mypCode || "").toLowerCase();
  const codeMatch = code.match(/grandarchive_([a-z0-9]+)_([a-z0-9]+)/i);
  if (codeMatch) {
    return {
      setPrefix: codeMatch[1].toUpperCase(),
      collectorNumber: codeMatch[2],
    };
  }

  if (item.rawSubtitle) {
    const subMatch = item.rawSubtitle.match(/#([a-z0-9]+)/i);
    const setMatch = item.rawSubtitle.match(/^([A-Za-z0-9\s]+?)\s*-\s*#/);
    return {
      setPrefix: setMatch ? setMatch[1].trim().toUpperCase() : null,
      collectorNumber: subMatch ? subMatch[1] : null,
    };
  }

  return { setPrefix: null, collectorNumber: null };
}

/**
 * Maps raw or DB element strings to canonical Game Nomenclature Element title.
 */
function toCanonicalElement(rawElement?: string | null): string {
  if (!rawElement) return UNMATCHED_ELEMENT;
  const norm = normalizeElement(rawElement);
  if (norm === "EXALTED") return "Norm";
  const label = ELEMENT_LABELS[norm];
  if (label && CANONICAL_ELEMENT_ORDER.includes(label)) {
    return label;
  }
  return UNMATCHED_ELEMENT;
}

const SHIPPING_PRIORITY_SCORES: ReadonlyArray<[RegExp, number]> = [
  [/sedex/i, 10],
  [/pac/i, 9],
  [/fixo|rastreio/i, 8],
  [/combinado/i, 1],
];

/**
 * Prioritizes shipping methods: paid/tracked methods first, then Frete combinado.
 */
export function getPrimaryShippingMethod(methods: string[]): string {
  if (methods.length === 0) return "";

  const scoreMethod = (method: string): number => {
    for (const [pattern, score] of SHIPPING_PRIORITY_SCORES) {
      if (pattern.test(method)) return score;
    }
    return 5;
  };

  const ranked = [...methods].sort((a, b) => scoreMethod(b) - scoreMethod(a));
  return ranked[0];
}

/**
 * Enriches a single Grand Archive order item against the catalog repository.
 */
async function enrichFulfillmentItem(
  item: RawMypOrderItemInput,
  database?: CatalogDatabase
): Promise<EnrichedFulfillmentItem> {
  const { setPrefix: extractedPrefix, collectorNumber: extractedNum } =
    extractSetAndCollectorNumber(item);

  const match = await findCatalogEditionForFulfillment(
    {
      setPrefix: extractedPrefix,
      collectorNumber: extractedNum,
      cardName: item.rawTitle,
    },
    database
  );

  const isMatched = Boolean(match);
  const cardSlug = match ? match.cardSlug : null;
  const cardName = match ? match.cardName : item.rawTitle;
  const element = isMatched ? toCanonicalElement(match?.element) : UNMATCHED_ELEMENT;
  const setPrefix = match ? match.setPrefix : extractedPrefix || "UNK";
  const collectorNumber = match ? match.collectorNumber : extractedNum || null;
  const rarity = match ? match.rarity : null;
  const imageUrl = match ? match.imageUrl : null;

  const itemKey = `${cardSlug || item.mypCode}:${setPrefix}:${
    collectorNumber || "none"
  }:${item.isFoil ? "foil" : "normal"}:${item.condition}`.toLowerCase();

  return {
    itemKey,
    isGrandArchive: true,
    cardSlug,
    cardName,
    element,
    setPrefix,
    collectorNumber,
    rarity,
    imageUrl,
    condition: item.condition,
    isFoil: item.isFoil,
    quantity: item.quantity,
    unitPriceBrl: item.unitPriceBrl,
    mypCode: item.mypCode,
  };
}

/**
 * Aggregates an enriched item into the Pick List element bucket.
 */
function addToPickList(
  pickListByElement: Record<string, PickListEntry[]>,
  enriched: EnrichedFulfillmentItem,
  order: RawMypFulfillmentOrderInput
): void {
  const bucket = pickListByElement[enriched.element] || pickListByElement[UNMATCHED_ELEMENT];
  const existing = bucket.find((e) => e.itemKey === enriched.itemKey);

  if (existing) {
    existing.totalQuantity += enriched.quantity;
    const ref = existing.orderReferences.find((r) => r.orderId === order.orderId);
    if (ref) {
      ref.quantity += enriched.quantity;
    } else {
      existing.orderReferences.push({
        orderId: order.orderId,
        buyerNick: order.buyerNick,
        quantity: enriched.quantity,
      });
    }
  } else {
    bucket.push({
      itemKey: enriched.itemKey,
      cardSlug: enriched.cardSlug,
      cardName: enriched.cardName,
      element: enriched.element,
      setPrefix: enriched.setPrefix,
      collectorNumber: enriched.collectorNumber,
      rarity: enriched.rarity,
      imageUrl: enriched.imageUrl,
      condition: enriched.condition,
      isFoil: enriched.isFoil,
      totalQuantity: enriched.quantity,
      orderReferences: [
        {
          orderId: order.orderId,
          buyerNick: order.buyerNick,
          quantity: enriched.quantity,
        },
      ],
    });
  }
}

/**
 * Constructs and ranks buyer pack groups.
 */
function buildBuyerPacks(buyerPacksMap: Map<string, BuyerPackSubOrder[]>): BuyerPackGroup[] {
  const buyerPacks: BuyerPackGroup[] = [];

  for (const [buyerNick, subOrders] of buyerPacksMap.entries()) {
    const shippingMethods = Array.from(new Set(subOrders.map((o) => o.shippingMethod)));
    const totalItems = subOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    buyerPacks.push({
      buyerNick,
      totalOrders: subOrders.length,
      totalItems,
      shippingMethods,
      primaryShippingMethod: getPrimaryShippingMethod(shippingMethods),
      orders: subOrders.sort((a, b) => a.orderId.localeCompare(b.orderId)),
    });
  }

  // Multi-order buyers first, then alphabetical by buyerNick
  buyerPacks.sort((a, b) => {
    if (a.totalOrders !== b.totalOrders) {
      return b.totalOrders - a.totalOrders;
    }
    return a.buyerNick.localeCompare(b.buyerNick, undefined, { sensitivity: "base" });
  });

  return buyerPacks;
}

/**
 * Pure domain service building the complete Fulfillment Report for order picking and packing.
 */
export async function buildFulfillmentReport(
  orders: RawMypFulfillmentOrderInput[],
  database?: CatalogDatabase,
  currentTimeMs: number = Date.now()
): Promise<FulfillmentReport> {
  const pickListByElement: Record<string, PickListEntry[]> = {};
  for (const el of CANONICAL_ELEMENT_ORDER) {
    pickListByElement[el] = [];
  }

  const nonGrandArchiveOrders: NonGrandArchiveOrderNotice[] = [];
  const buyerPacksMap = new Map<string, BuyerPackSubOrder[]>();

  let totalGrandArchiveOrders = 0;
  let totalGrandArchiveCopies = 0;

  for (const order of orders) {
    const gaItems = order.items.filter(isGrandArchiveItem);
    const nonGaItems = order.items.filter((i) => !isGrandArchiveItem(i));

    // Handle orders with non-GA items
    if (nonGaItems.length > 0) {
      nonGrandArchiveOrders.push(toNonGaNotice(order, nonGaItems));
      if (gaItems.length === 0) {
        continue;
      }
    }

    totalGrandArchiveOrders++;
    const enrichedSubOrderItems: EnrichedFulfillmentItem[] = [];

    for (const item of gaItems) {
      const enrichedItem = await enrichFulfillmentItem(item, database);
      enrichedSubOrderItems.push(enrichedItem);
      totalGrandArchiveCopies += item.quantity;
      addToPickList(pickListByElement, enrichedItem, order);
    }

    const subOrder: BuyerPackSubOrder = {
      orderId: order.orderId,
      orderDate: order.orderDate,
      shippingMethod: order.shippingMethod,
      status: order.status,
      orderUrl: order.orderUrl,
      items: enrichedSubOrderItems,
    };

    const existingBuyerOrders = buyerPacksMap.get(order.buyerNick) || [];
    existingBuyerOrders.push(subOrder);
    buyerPacksMap.set(order.buyerNick, existingBuyerOrders);
  }

  // Alphabetically sort cards within each element
  for (const el of CANONICAL_ELEMENT_ORDER) {
    pickListByElement[el].sort((a, b) =>
      a.cardName.localeCompare(b.cardName, undefined, { sensitivity: "base" })
    );
  }

  const buyerPacks = buildBuyerPacks(buyerPacksMap);

  return {
    generatedAt: Math.floor(currentTimeMs / 1000),
    totalGrandArchiveOrders,
    totalGrandArchiveCopies,
    pickListByElement,
    buyerPacks,
    nonGrandArchiveOrders,
  };
}
