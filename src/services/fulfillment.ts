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
} from "@ga/contracts";
import {
  findCatalogEditionForFulfillment,
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
  if (!rawElement) return "UNMATCHED";
  const norm = normalizeElement(rawElement);
  const label = ELEMENT_LABELS[norm];
  if (label && CANONICAL_ELEMENT_ORDER.includes(label)) {
    return label;
  }
  return "UNMATCHED";
}

/**
 * Prioritizes shipping methods: paid/tracked methods first, then Frete combinado.
 */
function getPrimaryShippingMethod(methods: string[]): string {
  if (methods.length === 0) return "Padrão";

  const ranked = [...methods].sort((a, b) => {
    const score = (m: string) => {
      const lower = m.toLowerCase();
      if (lower.includes("sedex")) return 10;
      if (lower.includes("pac")) return 9;
      if (lower.includes("fixo") || lower.includes("rastreio")) return 8;
      if (lower.includes("combinado")) return 1;
      return 5;
    };
    return score(b) - score(a);
  });

  return ranked[0];
}

/**
 * Pure domain service building the complete Fulfillment Report for order picking and packing.
 */
export async function buildFulfillmentReport(
  orders: RawMypFulfillmentOrderInput[],
  database?: any
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

    // Handle non-GA orders
    if (gaItems.length === 0 && nonGaItems.length > 0) {
      const detectedTcg = detectNonGaTcg(nonGaItems[0]);
      nonGrandArchiveOrders.push({
        orderId: order.orderId,
        orderDate: order.orderDate,
        buyerNick: order.buyerNick,
        orderUrl: order.orderUrl,
        detectedTcg,
        itemCount: nonGaItems.length,
      });
      continue;
    }

    if (nonGaItems.length > 0) {
      nonGrandArchiveOrders.push({
        orderId: order.orderId,
        orderDate: order.orderDate,
        buyerNick: order.buyerNick,
        orderUrl: order.orderUrl,
        detectedTcg: detectNonGaTcg(nonGaItems[0]),
        itemCount: nonGaItems.length,
      });
    }

    totalGrandArchiveOrders++;

    const enrichedSubOrderItems: EnrichedFulfillmentItem[] = [];

    for (const item of gaItems) {
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
      const element = isMatched ? toCanonicalElement(match?.element) : "UNMATCHED";
      const setPrefix = match ? match.setPrefix : extractedPrefix || "UNK";
      const collectorNumber = match ? match.collectorNumber : extractedNum || null;
      const rarity = match ? match.rarity : null;
      const imageUrl = match ? match.imageUrl : null;

      const itemKey = `${cardSlug || item.mypCode}:${setPrefix}:${
        collectorNumber || "none"
      }:${item.isFoil ? "foil" : "normal"}:${item.condition}`.toLowerCase();

      const enrichedItem: EnrichedFulfillmentItem = {
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

      enrichedSubOrderItems.push(enrichedItem);
      totalGrandArchiveCopies += item.quantity;

      // Aggregate into pickListByElement
      const bucket = pickListByElement[element] || pickListByElement["UNMATCHED"];
      const existing = bucket.find((e) => e.itemKey === itemKey);

      if (existing) {
        existing.totalQuantity += item.quantity;
        const ref = existing.orderReferences.find((r) => r.orderId === order.orderId);
        if (ref) {
          ref.quantity += item.quantity;
        } else {
          existing.orderReferences.push({
            orderId: order.orderId,
            buyerNick: order.buyerNick,
            quantity: item.quantity,
          });
        }
      } else {
        bucket.push({
          itemKey,
          cardSlug,
          cardName,
          element,
          setPrefix,
          collectorNumber,
          rarity,
          imageUrl,
          condition: item.condition,
          isFoil: item.isFoil,
          totalQuantity: item.quantity,
          orderReferences: [
            {
              orderId: order.orderId,
              buyerNick: order.buyerNick,
              quantity: item.quantity,
            },
          ],
        });
      }
    }

    // Sub-order for buyer packs
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

  // Construct buyer packs
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

  // Sort buyers: multi-order buyers first, then tracked shipping, then alphabetical
  buyerPacks.sort((a, b) => {
    if (a.totalOrders !== b.totalOrders) {
      return b.totalOrders - a.totalOrders;
    }
    return a.buyerNick.localeCompare(b.buyerNick, undefined, { sensitivity: "base" });
  });

  return {
    generatedAt: Math.floor(Date.now() / 1000),
    totalGrandArchiveOrders,
    totalGrandArchiveCopies,
    pickListByElement,
    buyerPacks,
    nonGrandArchiveOrders,
  };
}
