import { eq, and, inArray, sql, isNull, isNotNull } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  mypCards,
  mypMarketCards,
  metaStaples,
} from "../db/schema";
import { DEFAULT_USER_ID } from "./seed";

export interface ParsedMypItem {
  rawName: string;
  cleanName: string;
  setPrefix: string;
  quantity: number;
  price: string;
  quality: string;
  isFoil: boolean;
  mypItemId: string | null;
  mypProductUrl: string | null;
}

export interface MarketplaceDeckNeed {
  deckId: string;
  deckName: string;
  quantity: number;
  zone: string;
}

export interface MarketplaceCardItem {
  id: string;
  cardSlug: string | null;
  editionId: string | null;
  rawName: string;
  cardName: string;
  setPrefix: string;
  element: string;
  class: string;
  type: string;
  rarity: number;
  imageUrl: string | null;
  quantity: number;
  price: string;
  priceNumeric: number;
  quality: string;
  isFoil: boolean;
  mypItemId: string | null;
  mypProductUrl: string | null;
  deckNeeds: MarketplaceDeckNeed[];
  totalDeckDemand: number;
  totalBinderOwned: number;
  concurrentMissing: number;
  isShortageOffset: boolean;
  isMetaStaple?: boolean;
  stapleCategories?: string[];
  stapleInclusionRate?: string | null;
  stapleRecommendedCopies?: number | null;
  isStapleDeficit?: boolean;
}

export interface MarketplaceSummary {
  totalListings: number;
  totalCopies: number;
  totalValueBrl: number;
  shortageOffsetCount: number;
  shortageOffsetCopies: number;
  stapleDeficitCount?: number;
  stapleDeficitCopies?: number;
}

export interface MarketplaceReport {
  mypUsername: string | null;
  summary: MarketplaceSummary;
  cards: MarketplaceCardItem[];
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBrlPrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

export type PriceFairnessTier =
  | "HEAVILY_OVERPRICED"
  | "SLIGHTLY_OVERPRICED"
  | "NORMAL"
  | "BELOW_MARKET"
  | "UNKNOWN";

export interface PriceFairnessEvaluation {
  tier: PriceFairnessTier;
  ratio: number | null;
  markupPercent: number | null;
  tcgPrice: string | null;
  tcgPriceNumeric: number | null;
}

export function extractTcgPlayerPrice(html: string): {
  tcgPrice: string;
  tcgPriceNumeric: number;
} | null {
  if (!html) return null;
  const match = html.match(
    /resumo-preco--tcg[\s\S]*?<span class=["']moeda["']>([\s\S]*?)<\/span>/i
  );
  if (!match) return null;
  const rawPrice = match[1]
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  const numeric = parseBrlPrice(rawPrice);
  if (numeric <= 0) return null;
  return {
    tcgPrice: rawPrice,
    tcgPriceNumeric: numeric,
  };
}

export function evaluatePriceFairness(
  priceNumeric: number,
  tcgPriceNumeric?: number | null,
  tcgPrice?: string | null
): PriceFairnessEvaluation {
  if (
    !tcgPriceNumeric ||
    tcgPriceNumeric <= 0 ||
    !priceNumeric ||
    priceNumeric <= 0 ||
    !Number.isFinite(tcgPriceNumeric) ||
    !Number.isFinite(priceNumeric)
  ) {
    return {
      tier: "UNKNOWN",
      ratio: null,
      markupPercent: null,
      tcgPrice: tcgPrice || null,
      tcgPriceNumeric: tcgPriceNumeric || null,
    };
  }

  const ratio = priceNumeric / tcgPriceNumeric;
  const markupPercent = Math.round((ratio - 1) * 100);

  // User rule:
  // > 2.0x => HEAVILY OVERPRICED
  // 1.2x to 2.0x => Slightly overpriced
  // 1.0x to 1.2x (up to 20% higher) => normal
  // < 1.0x => Below market
  if (ratio > 2.0) {
    return {
      tier: "HEAVILY_OVERPRICED",
      ratio,
      markupPercent,
      tcgPrice: tcgPrice || null,
      tcgPriceNumeric,
    };
  }
  if (ratio > 1.2) {
    return {
      tier: "SLIGHTLY_OVERPRICED",
      ratio,
      markupPercent,
      tcgPrice: tcgPrice || null,
      tcgPriceNumeric,
    };
  }
  if (ratio >= 1.0) {
    return {
      tier: "NORMAL",
      ratio,
      markupPercent,
      tcgPrice: tcgPrice || null,
      tcgPriceNumeric,
    };
  }
  return {
    tier: "BELOW_MARKET",
    ratio,
    markupPercent,
    tcgPrice: tcgPrice || null,
    tcgPriceNumeric,
  };
}

export function parseMypHtml(html: string): ParsedMypItem[] {
  const results: ParsedMypItem[] = [];
  const cardIndices: number[] = [];
  let pos = 0;

  while ((pos = html.indexOf('<div class="card"', pos)) !== -1) {
    cardIndices.push(pos);
    pos += 10;
  }

  for (let i = 0; i < cardIndices.length; i++) {
    const start = cardIndices[i];
    const end = i < cardIndices.length - 1 ? cardIndices[i + 1] : start + 3500;
    const chunk = html.slice(start, end);

    const nameMatch = chunk.match(/<div class="card-name">\s*<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/i);
    if (!nameMatch) continue;

    const rawName = decodeHtmlEntities(nameMatch[1]);
    const cleanName = rawName.replace(/\s*\([^)]*\)/g, "").trim();

    const edMatch = chunk.match(/<span class="card-edicao"[^>]*>([\s\S]*?)<\/span>/i);
    const setPrefix = edMatch ? decodeHtmlEntities(edMatch[1]) : "UNK";

    const qtyMatch = chunk.match(/<span class="quantidade-num">([\s\S]*?)<\/span>/i);
    const quantity = qtyMatch ? Math.max(1, parseInt(qtyMatch[1].trim(), 10) || 1) : 1;

    const priceMatch = chunk.match(/<span class="card-preco[^"]*">([\s\S]*?)<\/span>/i);
    const price = priceMatch ? decodeHtmlEntities(priceMatch[1]) : "R$ 0,00";

    const qualMatch = chunk.match(/title="([A-Z]{2}\s*-[^"]+)"/i);
    const quality = qualMatch ? decodeHtmlEntities(qualMatch[1]) : "NM";

    const hrefMatch = chunk.match(/<a[^>]+class="card-img-link"[^>]+href="([^"]+)"/i);
    const mypProductUrl = hrefMatch
      ? hrefMatch[1].startsWith("http")
        ? hrefMatch[1]
        : `https://mypcards.com${hrefMatch[1]}`
      : null;

    const itemIdMatch = chunk.match(/data-ga-item-id="([^"]+)"/i);
    const mypItemId = itemIdMatch ? itemIdMatch[1].trim() : null;

    const lowerRaw = rawName.toLowerCase();
    const isFoil =
      lowerRaw.includes("foil") ||
      lowerRaw.includes("curio") ||
      chunk.includes('"versao":"Foil"');

    results.push({
      rawName,
      cleanName,
      setPrefix,
      quantity,
      price,
      quality,
      isFoil,
      mypItemId,
      mypProductUrl,
    });
  }

  return results;
}

export function cleanMypUsername(input: string): string {
  const trimmed = input.trim();
  // Support full URLs like https://mypcards.com/Fabrino or https://mypcards.com/Fabrino/grandarchive
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  } catch {}
  return trimmed.replace(/^@/, "").split("/")[0].trim();
}

import { execFileSync } from "child_process";

async function fetchMypText(url: string, customFetch?: typeof fetch): Promise<string> {
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  if (customFetch && customFetch !== fetch) {
    const res = await customFetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch MyP URL (${res.status})`);
    }
    if (typeof res.text === "function") {
      return await res.text();
    }
    const json = await res.json();
    return JSON.stringify(json);
  }

  // 1. If FlareSolverr proxy is configured (e.g. in GitHub Actions runner), query it
  const flareUrl = process.env.FLARESOLVERR_URL;
  if (flareUrl) {
    try {
      const solverRes = await fetch(`${flareUrl.replace(/\/$/, "")}/v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: "request.get",
          url,
          maxTimeout: 60000,
        }),
      });
      if (solverRes.ok) {
        const solverJson = await solverRes.json();
        if (solverJson?.solution?.response) {
          return solverJson.solution.response;
        }
      }
    } catch {
      // Fallback to normal fetch/curl
    }
  }

  // Try native fetch first; if Cloudflare blocks Undici TLS (403), use system curl
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });
    if (res.ok) {
      return await res.text();
    }
  } catch {
    // Fallback to curl below
  }

  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  const stdout = execFileSync(
    curlBin,
    ["-s", "-L", "--max-time", "20", "-A", userAgent, url],
    { encoding: "utf-8", maxBuffer: 15 * 1024 * 1024 }
  );
  if (!stdout || stdout.trim().length === 0) {
    throw new Error("Empty response from MyP Cards");
  }
  return stdout;
}

// ---------------------------------------------------------------------------
// Shared Catalog Resolution & Listing Matching Helpers
// ---------------------------------------------------------------------------

export interface CatalogResolutionData {
  allCatalogCards: { slug: string; name: string }[];
  allCatalogEditions: { id: string; cardSlug: string; setPrefix: string; collectorNumber: string }[];
  cardByLowerName: Map<string, { slug: string; name: string }>;
  cardByAlphaNum: Map<string, { slug: string; name: string }>;
}

export async function loadCatalogResolutionData(database: any): Promise<CatalogResolutionData> {
  const allCatalogCards = await database
    .select({
      slug: cards.slug,
      name: cards.name,
    })
    .from(cards);

  const allCatalogEditions = await database
    .select({
      id: cardEditions.id,
      cardSlug: cardEditions.cardSlug,
      setPrefix: cardEditions.setPrefix,
      collectorNumber: cardEditions.collectorNumber,
    })
    .from(cardEditions);

  const cardByLowerName = new Map<string, { slug: string; name: string }>();
  const cardByAlphaNum = new Map<string, { slug: string; name: string }>();
  for (const c of allCatalogCards) {
    const lower = c.name.toLowerCase().trim();
    cardByLowerName.set(lower, c);
    cardByAlphaNum.set(lower.replace(/[^a-z0-9]/g, ""), c);
  }

  return { allCatalogCards, allCatalogEditions, cardByLowerName, cardByAlphaNum };
}

export function resolveMypItem(
  item: ParsedMypItem,
  catalog: CatalogResolutionData
): { matchedCard: { slug: string; name: string } | null; editionId: string | null } {
  const lowerClean = item.cleanName.toLowerCase().trim();

  let matchedCard = catalog.cardByLowerName.get(lowerClean) || null;

  // Fallback 1: Double-faced card split on `//`
  if (!matchedCard && lowerClean.includes("//")) {
    const frontFace = lowerClean.split("//")[0].trim();
    matchedCard = catalog.cardByLowerName.get(frontFace) || null;
  }

  // Parse mypItemId (e.g. "grandarchive_ptm_086p1")
  let parsedSet = item.setPrefix.toUpperCase().split(" ")[0];
  let parsedNum: string | null = null;
  if (item.mypItemId) {
    const m = item.mypItemId.match(/^grandarchive_([a-z0-9]+)_([0-9]+)/i);
    if (m) {
      parsedSet = m[1].toUpperCase();
      parsedNum = m[2];
    }
  }

  // Fallback 2: Match by set_prefix + collector_number from mypItemId
  if (!matchedCard && parsedSet && parsedNum) {
    const edByNum = catalog.allCatalogEditions.find(
      (e: any) =>
        e.setPrefix.toUpperCase() === parsedSet &&
        e.collectorNumber.padStart(3, "0") === parsedNum!.padStart(3, "0")
    );
    if (edByNum) {
      matchedCard = catalog.allCatalogCards.find((c: any) => c.slug === edByNum.cardSlug) || null;
    }
  }

  // Fallback 3: Alphanumeric normalized match
  if (!matchedCard) {
    const alpha = lowerClean.split("//")[0].replace(/[^a-z0-9]/g, "");
    matchedCard = catalog.cardByAlphaNum.get(alpha) || null;
  }

  let editionId: string | null = null;
  if (matchedCard) {
    const edsForSlug = catalog.allCatalogEditions.filter(
      (e: any) => e.cardSlug === matchedCard!.slug
    );
    const exactEd =
      edsForSlug.find(
        (e: any) => e.setPrefix.toUpperCase() === item.setPrefix.toUpperCase()
      ) ||
      edsForSlug.find((e: any) => e.setPrefix.toUpperCase() === parsedSet) ||
      edsForSlug[0];
    editionId = exactEd?.id || null;
  }

  return { matchedCard, editionId };
}

export interface MarketItemLike {
  mypItemId?: string | null;
  editionId?: string | null;
  cardSlug?: string | null;
  setPrefix?: string | null;
  isFoil?: boolean | null;
  quantity: number | string;
}

export function isSameMyPListing(
  itemA: MarketItemLike,
  itemB: MarketItemLike
): boolean {
  // If both have mypItemId, that is the authoritative identifier on MyP Cards
  if (itemA.mypItemId && itemB.mypItemId) {
    return itemA.mypItemId === itemB.mypItemId;
  }

  // When matching across edition or setPrefix, finishes must match (non-foil vs foil)
  const foilMatch = Boolean(itemA.isFoil) === Boolean(itemB.isFoil);
  if (!foilMatch) {
    return false;
  }

  // Match by editionId if present on both
  if (itemA.editionId && itemB.editionId) {
    return itemA.editionId === itemB.editionId;
  }

  // Fallback: match by cardSlug and setPrefix
  if (
    itemA.cardSlug &&
    itemB.cardSlug &&
    itemA.cardSlug === itemB.cardSlug &&
    itemA.setPrefix &&
    itemB.setPrefix &&
    itemA.setPrefix.toUpperCase() === itemB.setPrefix.toUpperCase()
  ) {
    return true;
  }

  return false;
}

export function calculateNetMarketStock(
  marketItem: MarketItemLike,
  userStoreItems: MarketItemLike[]
): { personalStoreQuantity: number; netExternalStock: number } {
  let personalStoreQuantity = 0;
  for (const userItem of userStoreItems) {
    if (isSameMyPListing(marketItem, userItem)) {
      personalStoreQuantity += Number(userItem.quantity) || 0;
    }
  }
  const globalQty = Number(marketItem.quantity) || 0;
  const netExternalStock = Math.max(0, globalQty - personalStoreQuantity);
  return { personalStoreQuantity, netExternalStock };
}

export async function syncUserMarketplace(
  userId: string,
  mypUsernameInput: string,
  database: any = db,
  customFetch?: typeof fetch
): Promise<{
  totalSynced: number;
  matchedCount: number;
  unmatchedCount: number;
  username: string;
}> {
  const username = cleanMypUsername(mypUsernameInput);
  if (!username) {
    throw new Error("A valid MyP Cards username is required.");
  }

  // Ensure user exists and update their mypUsername
  const existingUsers = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existingUsers.length === 0) {
    const fallbackUsers = await database.select().from(users).limit(1);
    if (fallbackUsers.length === 0) {
      await database.insert(users).values({
        id: userId,
        name: username,
        friendCode: `GA-${userId.slice(0, 5).toUpperCase()}`,
        mypUsername: username,
      });
    } else {
      userId = fallbackUsers[0].id;
      await database
        .update(users)
        .set({ mypUsername: username })
        .where(eq(users.id, userId));
    }
  } else {
    await database
      .update(users)
      .set({ mypUsername: username })
      .where(eq(users.id, userId));
  }

  // 1. Fetch Page 1 specifically for Grand Archive store
  const page1Url = `https://mypcards.com/${encodeURIComponent(username)}/grandarchive`;
  const p1Html = await fetchMypText(page1Url, customFetch);
  const parsedItems: ParsedMypItem[] = [...parseMypHtml(p1Html)];

  // 2. Fetch subsequent pages via /usuario/load-more?nick=...&marca=grandarchive
  let page = 2;
  const maxPages = 35; // up to ~1050 listings safety cap
  while (page <= maxPages) {
    const moreUrl = `https://mypcards.com/usuario/load-more?nick=${encodeURIComponent(
      username
    )}&marca=grandarchive&page=${page}`;
    try {
      const moreText = await fetchMypText(moreUrl, customFetch);
      const json = JSON.parse(moreText);
      if (!json || !json.success || !json.html) break;
      const pageItems = parseMypHtml(json.html);
      if (pageItems.length === 0) break;
      parsedItems.push(...pageItems);
      page++;
    } catch {
      break;
    }
  }

  if (parsedItems.length === 0) {
    return {
      totalSynced: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      username,
    };
  }

  // 3. Resolve against local Catalog
  const catalog = await loadCatalogResolutionData(database);

  let matchedCount = 0;
  let unmatchedCount = 0;

  // Wipe previous MyP snapshot for this user only after successfully parsing new items
  await database.delete(mypCards).where(eq(mypCards.userId, userId));

  const rowsToInsert: any[] = [];
  const batchTimestamp = Date.now();

  for (let idx = 0; idx < parsedItems.length; idx++) {
    const item = parsedItems[idx];
    const { matchedCard, editionId } = resolveMypItem(item, catalog);
    if (matchedCard) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }

    rowsToInsert.push({
      id: `myp-${userId}-${idx}-${batchTimestamp}`,
      userId,
      cardSlug: matchedCard?.slug || null,
      editionId,
      rawName: item.rawName,
      cardName: matchedCard?.name || item.cleanName,
      setPrefix: item.setPrefix,
      quantity: item.quantity,
      price: item.price,
      quality: item.quality,
      isFoil: item.isFoil,
      mypItemId: item.mypItemId,
      mypProductUrl: item.mypProductUrl,
    });
  }

  const chunkSize = 50;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    await database.insert(mypCards).values(rowsToInsert.slice(i, i + chunkSize));
  }

  return {
    totalSynced: parsedItems.length,
    matchedCount,
    unmatchedCount,
    username,
  };
}

async function resolveEffectiveUser(
  userId: string,
  database: any
): Promise<{ effectiveUserId: string; mypUsername: string | null }> {
  const userRows = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length > 0) {
    return {
      effectiveUserId: userRows[0].id,
      mypUsername: userRows[0].mypUsername || null,
    };
  }

  const anyUser = await database.select().from(users).limit(1);
  if (anyUser.length > 0) {
    return {
      effectiveUserId: anyUser[0].id,
      mypUsername: anyUser[0].mypUsername || null,
    };
  }

  return { effectiveUserId: userId, mypUsername: null };
}

export async function getUserMarketplaceReport(
  userId: string,
  database: any = db
): Promise<MarketplaceReport> {
  const { effectiveUserId, mypUsername } = await resolveEffectiveUser(
    userId,
    database
  );

  const listings = await database
    .select({
      id: mypCards.id,
      cardSlug: mypCards.cardSlug,
      editionId: mypCards.editionId,
      rawName: mypCards.rawName,
      cardName: mypCards.cardName,
      setPrefix: mypCards.setPrefix,
      quantity: mypCards.quantity,
      price: mypCards.price,
      quality: mypCards.quality,
      isFoil: mypCards.isFoil,
      mypItemId: mypCards.mypItemId,
      mypProductUrl: mypCards.mypProductUrl,
      element: cards.element,
      class: cards.class,
      type: cards.type,
      rarity: cardEditions.rarity,
      imageUrl: cardEditions.imageUrl,
    })
    .from(mypCards)
    .leftJoin(cards, eq(mypCards.cardSlug, cards.slug))
    .leftJoin(cardEditions, eq(mypCards.editionId, cardEditions.id))
    .where(eq(mypCards.userId, effectiveUserId));

  // Fetch user decks & deck requirements
  const userDecks = await database
    .select()
    .from(decks)
    .where(eq(decks.userId, effectiveUserId));
  const deckIds = userDecks.map((d: any) => d.id);

  let allDeckCards: any[] = [];
  if (deckIds.length > 0) {
    allDeckCards = await database
      .select({
        deckId: deckCards.deckId,
        deckName: decks.name,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
        zone: deckCards.zone,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(deckCards.deckId, deckIds));
  }

  // Fetch user binder copies
  const binderItems = await database
    .select({
      cardSlug: cardEditions.cardSlug,
      quantity: collectionItems.quantity,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, effectiveUserId));

  const binderOwnedBySlug = new Map<string, number>();
  for (const item of binderItems) {
    binderOwnedBySlug.set(
      item.cardSlug,
      (binderOwnedBySlug.get(item.cardSlug) || 0) + Number(item.quantity)
    );
  }

  // Fetch format Meta Staples
  const allStaples = await database.select().from(metaStaples).all();
  const staplesBySlug = new Map<string, any>();
  for (const s of allStaples) {
    staplesBySlug.set(s.cardSlug, s);
  }

  let totalCopies = 0;
  let totalValueBrl = 0;
  let shortageOffsetCount = 0;
  let shortageOffsetCopies = 0;
  let stapleDeficitCount = 0;
  let stapleDeficitCopies = 0;
  const remainingMissingBySlug = new Map<string, number>();

  const enrichedCards: MarketplaceCardItem[] = listings.map((row: any) => {
    const qty = Number(row.quantity) || 1;
    const priceNumeric = parseBrlPrice(row.price);
    totalCopies += qty;
    totalValueBrl += priceNumeric * qty;

    const matchingDeckReqs = row.cardSlug
      ? allDeckCards.filter((dc: any) => dc.cardSlug === row.cardSlug)
      : [];

    const deckNeeds: MarketplaceDeckNeed[] = matchingDeckReqs.map((dc: any) => ({
      deckId: dc.deckId,
      deckName: dc.deckName,
      quantity: Number(dc.quantity),
      zone: dc.zone,
    }));

    const totalDeckDemand = deckNeeds.reduce((s, d) => s + d.quantity, 0);
    const totalBinderOwned = row.cardSlug ? binderOwnedBySlug.get(row.cardSlug) || 0 : 0;
    const concurrentMissing = Math.max(0, totalDeckDemand - totalBinderOwned);
    const isShortageOffset = concurrentMissing > 0;

    if (isShortageOffset && row.cardSlug) {
      shortageOffsetCount++;
      const remainingForSlug = remainingMissingBySlug.has(row.cardSlug)
        ? remainingMissingBySlug.get(row.cardSlug)!
        : concurrentMissing;
      const offsetByThisListing = Math.min(qty, remainingForSlug);
      shortageOffsetCopies += offsetByThisListing;
      remainingMissingBySlug.set(
        row.cardSlug,
        Math.max(0, remainingForSlug - offsetByThisListing)
      );
    }

    const stapleRecord = row.cardSlug ? staplesBySlug.get(row.cardSlug) : null;
    const isMetaStaple = Boolean(stapleRecord);
    const stapleCategories = stapleRecord
      ? JSON.parse(stapleRecord.categories || "[]")
      : undefined;
    const stapleInclusionRate = stapleRecord?.inclusionRate ?? null;
    const stapleRecommendedCopies = stapleRecord?.recommendedCopies ?? null;
    const isStapleDeficit = Boolean(
      isMetaStaple &&
      stapleRecommendedCopies &&
      totalBinderOwned < stapleRecommendedCopies
    );

    if (isStapleDeficit && !isShortageOffset) {
      stapleDeficitCount++;
      stapleDeficitCopies += qty;
    }

    return {
      id: row.id,
      cardSlug: row.cardSlug || null,
      editionId: row.editionId || null,
      rawName: row.rawName,
      cardName: row.cardName,
      setPrefix: row.setPrefix,
      element: row.element || "NORM",
      class: row.class || "ALL",
      type: row.type || "ACTION",
      rarity: row.rarity || 1,
      imageUrl: row.imageUrl || null,
      quantity: qty,
      price: row.price,
      priceNumeric,
      quality: row.quality,
      isFoil: Boolean(row.isFoil),
      mypItemId: row.mypItemId || null,
      mypProductUrl: row.mypProductUrl || null,
      deckNeeds,
      totalDeckDemand,
      totalBinderOwned,
      concurrentMissing,
      isShortageOffset,
      isMetaStaple,
      stapleCategories,
      stapleInclusionRate,
      stapleRecommendedCopies,
      isStapleDeficit,
    };
  });

  // Sort: Shortage offsets first, Staple Deficits second, then by price descending
  enrichedCards.sort((a, b) => {
    if (a.isShortageOffset !== b.isShortageOffset) {
      return a.isShortageOffset ? -1 : 1;
    }
    if (a.isStapleDeficit !== b.isStapleDeficit) {
      return a.isStapleDeficit ? -1 : 1;
    }
    return b.priceNumeric - a.priceNumeric;
  });

  return {
    mypUsername,
    summary: {
      totalListings: enrichedCards.length,
      totalCopies,
      totalValueBrl,
      shortageOffsetCount,
      shortageOffsetCopies,
      stapleDeficitCount,
      stapleDeficitCopies,
    },
    cards: enrichedCards,
  };
}

export async function claimMarketplaceCardForBinder(
  userId: string,
  mypCardId: string,
  quantityToClaim: number = 1,
  database: any = db
): Promise<{
  success: boolean;
  claimedQuantity: number;
  editionId: string | null;
  mypProductUrl: string | null;
}> {
  const { effectiveUserId } = await resolveEffectiveUser(userId, database);
  const rows = await database
    .select()
    .from(mypCards)
    .where(eq(mypCards.id, mypCardId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Marketplace listing not found.");
  }

  const listing = rows[0];
  if (listing.userId !== effectiveUserId) {
    throw new Error("Unauthorized to claim this marketplace listing.");
  }

  let editionId = listing.editionId;
  if (!editionId && listing.cardSlug) {
    const eds = await database
      .select()
      .from(cardEditions)
      .where(eq(cardEditions.cardSlug, listing.cardSlug))
      .limit(1);
    editionId = eds[0]?.id || null;
  }

  if (!editionId) {
    throw new Error("Could not resolve catalog edition for this card.");
  }

  const claimQty = Math.min(Math.max(1, quantityToClaim), Number(listing.quantity) || 1);
  const foilFlag = Boolean(listing.isFoil);

  // 1. Check existing collection_items (Binder) row
  const existingBinder = await database
    .select()
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.userId, effectiveUserId),
        eq(collectionItems.editionId, editionId),
        eq(collectionItems.foil, foilFlag)
      )
    )
    .limit(1);

  const binderWriteQuery =
    existingBinder.length > 0
      ? database
          .update(collectionItems)
          .set({
            quantity: Number(existingBinder[0].quantity) + claimQty,
            updatedAt: sql`(strftime('%s', 'now'))`,
          })
          .where(eq(collectionItems.id, existingBinder[0].id))
      : database.insert(collectionItems).values({
          id: `ci-myp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId: effectiveUserId,
          editionId,
          foil: foilFlag,
          quantity: claimQty,
          isDedicated: false,
        });

  // 2. Decrement or delete from myp_cards
  const remaining = Number(listing.quantity) - claimQty;
  const mypWriteQuery =
    remaining <= 0
      ? database.delete(mypCards).where(eq(mypCards.id, listing.id))
      : database
          .update(mypCards)
          .set({
            quantity: remaining,
            updatedAt: sql`(strftime('%s', 'now'))`,
          })
          .where(eq(mypCards.id, listing.id));

  if (typeof database.batch === "function") {
    await database.batch([binderWriteQuery, mypWriteQuery]);
  } else {
    await binderWriteQuery;
    await mypWriteQuery;
  }

  return {
    success: true,
    claimedQuantity: claimQty,
    editionId,
    mypProductUrl: listing.mypProductUrl || null,
  };
}

// ---------------------------------------------------------------------------
// Global Marketplace In-Stock Scanner & Reporting
// ---------------------------------------------------------------------------

export type ShortageTier = "HARD" | "SHARED" | "NONE";

export interface GlobalMarketplaceCardItem {
  id: string;
  cardSlug: string | null;
  editionId: string | null;
  rawName: string;
  cardName: string;
  setPrefix: string;
  element: string;
  class: string;
  type: string;
  rarity: number;
  imageUrl: string | null;
  quantity: number;
  personalStoreQuantity: number;
  netExternalStock: number;
  price: string;
  priceNumeric: number;
  tcgPrice: string | null;
  tcgPriceNumeric: number | null;
  priceFairness: PriceFairnessEvaluation;
  isFoil: boolean;
  mypItemId: string | null;
  mypProductUrl: string | null;
  deckNeeds: MarketplaceDeckNeed[];
  peakMissing: number;
  concurrentMissing: number;
  totalBinderOwned?: number;
  shortageTier: ShortageTier;
  isBuyableShortage: boolean;
  peakDeckName?: string | null;
  isMetaStaple?: boolean;
  stapleCategories?: string[];
  stapleInclusionRate?: string | null;
  stapleRecommendedCopies?: number | null;
  isStapleDeficit?: boolean;
}

export interface GlobalMarketSummary {
  totalListings: number;
  totalMarketCopies: number;
  hardShortagesCount: number;
  sharedShortagesCount: number;
  stapleDeficitsCount?: number;
  overpricedCount?: number;
  heavilyOverpricedCount?: number;
  lastSyncedAt: number | null;
}

export interface GlobalMarketReport {
  summary: GlobalMarketSummary;
  cards: GlobalMarketplaceCardItem[];
}

export async function syncGlobalMarketplace(
  database: any = db,
  customFetch?: typeof fetch
): Promise<{
  totalSynced: number;
  matchedCount: number;
  unmatchedCount: number;
}> {
  // 1. Fetch Page 1 of Grand Archive in-stock catalog
  const page1Url = "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1";
  const p1Html = await fetchMypText(page1Url, customFetch);
  const parsedItems: ParsedMypItem[] = [...parseMypHtml(p1Html)];

  // Determine total item count to calculate required pages
  let totalItems = 0;
  const countMatch =
    p1Html.match(/class=["']summary["'][^>]*><strong>(\d+)<\/strong>\s*itens/i) ||
    p1Html.match(/ProdutoScrollInfinito\([^,]+,[^,]+,\s*(\d+)\s*,\s*30\)/i);
  if (countMatch) {
    totalItems = parseInt(countMatch[1], 10) || 0;
  } else if (parsedItems.length > 0) {
    totalItems = parsedItems.length;
  }
  const maxPages = totalItems > 0 ? Math.min(75, Math.ceil(totalItems / 30)) : 1;

  // 2. Fetch subsequent pages in concurrent batches of 4
  const batchSize = 4;
  for (let p = 2; p <= maxPages; p += batchSize) {
    const pageNumbers: number[] = [];
    for (let i = 0; i < batchSize && p + i <= maxPages; i++) {
      pageNumbers.push(p + i);
    }

    const batchResults = await Promise.all(
      pageNumbers.map(async (page) => {
        const moreUrl = `https://mypcards.com/produto/load-more?marca=grandarchive&ProdutoSearch%5BexibirSomenteVenda%5D=1&page=${page}`;
        try {
          const moreText = await fetchMypText(moreUrl, customFetch);
          let htmlChunk = moreText;
          try {
            const json = JSON.parse(moreText);
            if (json && json.success && json.html) {
              htmlChunk = json.html;
            }
          } catch {
            // Not JSON; parse raw text
          }
          return parseMypHtml(htmlChunk);
        } catch {
          return [];
        }
      })
    );

    for (const items of batchResults) {
      parsedItems.push(...items);
    }

    // Polite delay between batches when fetching live network
    if (!customFetch && p + batchSize <= maxPages) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (parsedItems.length === 0) {
    return {
      totalSynced: 0,
      matchedCount: 0,
      unmatchedCount: 0,
    };
  }

  // 3. Resolve parsed items against local Catalog
  const catalog = await loadCatalogResolutionData(database);

  let matchedCount = 0;
  let unmatchedCount = 0;

  // Atomically replace myp_market_cards rows, preserving existing cached TCGPlayer prices
  const existingTcgMap = new Map<string, { tcgPrice: string; tcgPriceNumeric: number }>();
  try {
    const existingRows = await database
      .select({
        mypItemId: mypMarketCards.mypItemId,
        mypProductUrl: mypMarketCards.mypProductUrl,
        tcgPrice: mypMarketCards.tcgPrice,
        tcgPriceNumeric: mypMarketCards.tcgPriceNumeric,
      })
      .from(mypMarketCards);

    for (const r of existingRows) {
      if (r.tcgPriceNumeric !== null && r.tcgPriceNumeric !== undefined && r.tcgPrice) {
        if (r.mypProductUrl) {
          existingTcgMap.set(r.mypProductUrl, {
            tcgPrice: r.tcgPrice,
            tcgPriceNumeric: Number(r.tcgPriceNumeric),
          });
        }
        if (r.mypItemId) {
          existingTcgMap.set(r.mypItemId, {
            tcgPrice: r.tcgPrice,
            tcgPriceNumeric: Number(r.tcgPriceNumeric),
          });
        }
      }
    }
  } catch {
    // If table didn't have tcg columns yet, safe ignore
  }

  await database.delete(mypMarketCards);

  const rowsToInsert: any[] = [];
  const batchTimestamp = Date.now();

  for (let idx = 0; idx < parsedItems.length; idx++) {
    const item = parsedItems[idx];
    const { matchedCard, editionId } = resolveMypItem(item, catalog);
    if (matchedCard) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }

    const cachedTcg =
      (item.mypProductUrl && existingTcgMap.get(item.mypProductUrl)) ||
      (item.mypItemId && existingTcgMap.get(item.mypItemId)) ||
      null;

    rowsToInsert.push({
      id: item.mypItemId ? `mkt-${item.mypItemId}` : `mkt-${idx}-${batchTimestamp}`,
      cardSlug: matchedCard?.slug || null,
      editionId,
      rawName: item.rawName,
      cardName: matchedCard?.name || item.cleanName,
      setPrefix: item.setPrefix,
      quantity: item.quantity,
      price: item.price,
      priceNumeric: parseBrlPrice(item.price),
      tcgPrice: cachedTcg?.tcgPrice || null,
      tcgPriceNumeric: cachedTcg?.tcgPriceNumeric || null,
      isFoil: item.isFoil,
      mypItemId: item.mypItemId,
      mypProductUrl: item.mypProductUrl,
    });
  }

  const chunkSize = 50;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    await database.insert(mypMarketCards).values(rowsToInsert.slice(i, i + chunkSize));
  }

  return {
    totalSynced: parsedItems.length,
    matchedCount,
    unmatchedCount,
  };
}

export async function enrichMarketplaceTcgPrices(
  options: {
    cardIds?: string[];
    onlyShortages?: boolean;
    userId?: string;
    limit?: number;
  } = {},
  database: any = db,
  customFetch?: typeof fetch
): Promise<{ enrichedCount: number; failedCount: number }> {
  const limit = options.limit || 30;

  let candidateRows: { id: string; mypProductUrl: string | null }[] = [];

  if (options.cardIds && options.cardIds.length > 0) {
    candidateRows = await database
      .select({
        id: mypMarketCards.id,
        mypProductUrl: mypMarketCards.mypProductUrl,
      })
      .from(mypMarketCards)
      .where(
        and(
          isNotNull(mypMarketCards.mypProductUrl),
          inArray(mypMarketCards.id, options.cardIds)
        )
      )
      .limit(limit);
  } else if (options.onlyShortages) {
    // Find all card slugs required across user's decks
    let userDecksQuery = database.select({ id: decks.id }).from(decks);
    if (options.userId) {
      userDecksQuery = userDecksQuery.where(eq(decks.userId, options.userId));
    }
    const userDecksList = await userDecksQuery;
    const deckIds = userDecksList.map((d: any) => d.id);

    if (deckIds.length > 0) {
      const neededCards = await database
        .select({ cardSlug: deckCards.cardSlug })
        .from(deckCards)
        .where(inArray(deckCards.deckId, deckIds));
      const neededSlugs = Array.from(new Set(neededCards.map((nc: any) => nc.cardSlug)));

      if (neededSlugs.length > 0) {
        candidateRows = await database
          .select({
            id: mypMarketCards.id,
            mypProductUrl: mypMarketCards.mypProductUrl,
          })
          .from(mypMarketCards)
          .where(
            and(
              isNotNull(mypMarketCards.mypProductUrl),
              isNull(mypMarketCards.tcgPriceNumeric),
              inArray(mypMarketCards.cardSlug, neededSlugs)
            )
          )
          .limit(limit);
      }
    }
  } else {
    // General fallback: prioritize cards that have a product URL and lack a tcgPriceNumeric
    candidateRows = await database
      .select({
        id: mypMarketCards.id,
        mypProductUrl: mypMarketCards.mypProductUrl,
      })
      .from(mypMarketCards)
      .where(
        and(
          isNotNull(mypMarketCards.mypProductUrl),
          isNull(mypMarketCards.tcgPriceNumeric)
        )
      )
      .limit(limit);
  }

  let enrichedCount = 0;
  let failedCount = 0;

  const batchSize = 3;
  for (let i = 0; i < candidateRows.length; i += batchSize) {
    const chunk = candidateRows.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (row) => {
        if (!row.mypProductUrl) return;
        try {
          const html = await fetchMypText(row.mypProductUrl, customFetch);
          const extracted = extractTcgPlayerPrice(html);
          if (extracted) {
            await database
              .update(mypMarketCards)
              .set({
                tcgPrice: extracted.tcgPrice,
                tcgPriceNumeric: extracted.tcgPriceNumeric,
                updatedAt: sql`(strftime('%s', 'now'))`,
              })
              .where(eq(mypMarketCards.id, row.id));
            enrichedCount++;
          } else {
            // Mark checked with -1 so we don't query repeatedly
            await database
              .update(mypMarketCards)
              .set({
                tcgPrice: "N/A",
                tcgPriceNumeric: -1,
                updatedAt: sql`(strftime('%s', 'now'))`,
              })
              .where(eq(mypMarketCards.id, row.id));
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      })
    );
  }

  return { enrichedCount, failedCount };
}

export async function getGlobalMarketReport(
  userId?: string,
  database: any = db
): Promise<GlobalMarketReport> {
  const { effectiveUserId } = await resolveEffectiveUser(
    userId || DEFAULT_USER_ID,
    database
  );

  const marketRows = await database
    .select({
      id: mypMarketCards.id,
      cardSlug: mypMarketCards.cardSlug,
      editionId: mypMarketCards.editionId,
      rawName: mypMarketCards.rawName,
      cardName: mypMarketCards.cardName,
      setPrefix: mypMarketCards.setPrefix,
      quantity: mypMarketCards.quantity,
      price: mypMarketCards.price,
      priceNumeric: mypMarketCards.priceNumeric,
      tcgPrice: mypMarketCards.tcgPrice,
      tcgPriceNumeric: mypMarketCards.tcgPriceNumeric,
      isFoil: mypMarketCards.isFoil,
      mypItemId: mypMarketCards.mypItemId,
      mypProductUrl: mypMarketCards.mypProductUrl,
      updatedAt: mypMarketCards.updatedAt,
      element: cards.element,
      class: cards.class,
      type: cards.type,
      rarity: cardEditions.rarity,
      imageUrl: cardEditions.imageUrl,
    })
    .from(mypMarketCards)
    .leftJoin(cards, eq(mypMarketCards.cardSlug, cards.slug))
    .leftJoin(cardEditions, eq(mypMarketCards.editionId, cardEditions.id));

  // User decks & deck requirements
  const userDecks = await database
    .select()
    .from(decks)
    .where(eq(decks.userId, effectiveUserId));
  const deckIds = userDecks.map((d: any) => d.id);

  let allDeckCards: any[] = [];
  if (deckIds.length > 0) {
    allDeckCards = await database
      .select({
        deckId: deckCards.deckId,
        deckName: decks.name,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
        zone: deckCards.zone,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(deckCards.deckId, deckIds));
  }

  // User binder owned copies
  const binderItems = await database
    .select({
      cardSlug: cardEditions.cardSlug,
      quantity: collectionItems.quantity,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, effectiveUserId));

  const binderOwnedBySlug = new Map<string, number>();
  for (const item of binderItems) {
    binderOwnedBySlug.set(
      item.cardSlug,
      (binderOwnedBySlug.get(item.cardSlug) || 0) + Number(item.quantity)
    );
  }

  // User personal myp_cards (Store Listings)
  const userMypRows = await database
    .select({
      id: mypCards.id,
      cardSlug: mypCards.cardSlug,
      editionId: mypCards.editionId,
      setPrefix: mypCards.setPrefix,
      mypItemId: mypCards.mypItemId,
      quantity: mypCards.quantity,
    })
    .from(mypCards)
    .where(eq(mypCards.userId, effectiveUserId));

  // Pre-calculate demand and shortages per cardSlug
  const demandBySlug = new Map<
    string,
    {
      deckNeeds: MarketplaceDeckNeed[];
      totalDemand: number;
      peakDemand: number;
      concurrentMissing: number;
      peakMissing: number;
      peakShortageDeckName: string | null;
    }
  >();

  const uniqueDeckSlugs = Array.from(
    new Set(allDeckCards.map((d: any) => d.cardSlug as string))
  );
  for (const slug of uniqueDeckSlugs) {
    const matchingReqs = allDeckCards.filter((d: any) => d.cardSlug === slug);
    const deckNeeds: MarketplaceDeckNeed[] = matchingReqs.map((dc: any) => ({
      deckId: dc.deckId,
      deckName: dc.deckName,
      quantity: Number(dc.quantity),
      zone: dc.zone,
    }));
    const totalDemand = deckNeeds.reduce((s, d) => s + d.quantity, 0);

    const demandByDeckId: Record<string, { deckName: string; quantity: number }> = {};
    for (const req of deckNeeds) {
      if (!demandByDeckId[req.deckId]) {
        demandByDeckId[req.deckId] = { deckName: req.deckName, quantity: 0 };
      }
      demandByDeckId[req.deckId].quantity += req.quantity;
    }
    const peakDemand = Object.values(demandByDeckId).reduce((max, d) => Math.max(max, d.quantity), 0);
    const owned = binderOwnedBySlug.get(slug) || 0;
    const concurrentMissing = Math.max(0, totalDemand - owned);
    const peakMissing = Math.max(0, peakDemand - owned);

    // Identify the specific deck whose requirement causes peakMissing
    let peakShortageDeckName: string | null = null;
    if (peakMissing > 0) {
      const causingDeck =
        Object.values(demandByDeckId).find((d) => d.quantity === peakDemand && d.quantity > owned) ||
        Object.values(demandByDeckId).find((d) => d.quantity > owned);
      peakShortageDeckName = causingDeck?.deckName || deckNeeds[0]?.deckName || null;
    }

    demandBySlug.set(slug, {
      deckNeeds,
      totalDemand,
      peakDemand,
      concurrentMissing,
      peakMissing,
      peakShortageDeckName,
    });
  }

  // Load format Meta Staples
  const allStaples = await database.select().from(metaStaples).all();
  const staplesBySlug = new Map<string, any>();
  for (const s of allStaples) {
    staplesBySlug.set(s.cardSlug, s);
  }

  let totalMarketCopies = 0;
  let hardShortagesCount = 0;
  let sharedShortagesCount = 0;
  let stapleDeficitsCount = 0;
  let overpricedCount = 0;
  let heavilyOverpricedCount = 0;
  let latestUpdatedAt: number | null = null;

  const enrichedCards: GlobalMarketplaceCardItem[] = marketRows.map((row: any) => {
    const qty = Number(row.quantity) || 1;
    totalMarketCopies += qty;

    const rowUpdatedAtMs =
      row.updatedAt instanceof Date
        ? row.updatedAt.getTime()
        : row.updatedAt
        ? Number(row.updatedAt) * 1000
        : null;
    if (rowUpdatedAtMs && (!latestUpdatedAt || rowUpdatedAtMs > latestUpdatedAt)) {
      latestUpdatedAt = rowUpdatedAtMs;
    }

    // Match personal Store Listings using shared helper
    const { personalStoreQuantity, netExternalStock } = calculateNetMarketStock(
      row,
      userMypRows
    );

    const slugDemand = row.cardSlug ? demandBySlug.get(row.cardSlug) : null;
    const deckNeeds = slugDemand?.deckNeeds || [];
    const peakMissing = slugDemand?.peakMissing || 0;
    const concurrentMissing = slugDemand?.concurrentMissing || 0;
    const peakDeckName = slugDemand?.peakShortageDeckName || null;

    let shortageTier: ShortageTier = "NONE";
    if (peakMissing > 0) {
      shortageTier = "HARD";
    } else if (concurrentMissing > 0) {
      shortageTier = "SHARED";
    }

    const isBuyableShortage = shortageTier !== "NONE" && netExternalStock > 0;

    if (shortageTier === "HARD" && netExternalStock > 0) {
      hardShortagesCount++;
    } else if (shortageTier === "SHARED" && netExternalStock > 0) {
      sharedShortagesCount++;
    }

    const stapleRecord = row.cardSlug ? staplesBySlug.get(row.cardSlug) : null;
    const isMetaStaple = Boolean(stapleRecord);
    const stapleCategories = stapleRecord
      ? JSON.parse(stapleRecord.categories || "[]")
      : undefined;
    const stapleInclusionRate = stapleRecord?.inclusionRate ?? null;
    const stapleRecommendedCopies = stapleRecord?.recommendedCopies ?? null;
    const ownedBinder = row.cardSlug ? binderOwnedBySlug.get(row.cardSlug) || 0 : 0;
    const isStapleDeficit = Boolean(
      isMetaStaple &&
      stapleRecommendedCopies &&
      ownedBinder < stapleRecommendedCopies
    );

    if (isStapleDeficit && netExternalStock > 0) {
      stapleDeficitsCount++;
    }

    const priceNum = Number(row.priceNumeric) || parseBrlPrice(row.price);
    const tcgPriceNum =
      row.tcgPriceNumeric !== null && row.tcgPriceNumeric !== undefined
        ? Number(row.tcgPriceNumeric)
        : null;
    const priceFairness = evaluatePriceFairness(
      priceNum,
      tcgPriceNum,
      row.tcgPrice
    );

    if (priceFairness.tier === "HEAVILY_OVERPRICED") {
      heavilyOverpricedCount++;
      overpricedCount++;
    } else if (priceFairness.tier === "SLIGHTLY_OVERPRICED") {
      overpricedCount++;
    }

    return {
      id: row.id,
      cardSlug: row.cardSlug || null,
      editionId: row.editionId || null,
      rawName: row.rawName,
      cardName: row.cardName,
      setPrefix: row.setPrefix,
      element: row.element || "NORM",
      class: row.class || "ALL",
      type: row.type || "ACTION",
      rarity: row.rarity || 1,
      imageUrl: row.imageUrl || null,
      quantity: qty,
      personalStoreQuantity,
      netExternalStock,
      price: row.price,
      priceNumeric: priceNum,
      tcgPrice: row.tcgPrice || null,
      tcgPriceNumeric: tcgPriceNum,
      priceFairness,
      isFoil: Boolean(row.isFoil),
      mypItemId: row.mypItemId || null,
      mypProductUrl: row.mypProductUrl || null,
      deckNeeds,
      peakMissing,
      concurrentMissing,
      totalBinderOwned: ownedBinder,
      shortageTier,
      isBuyableShortage,
      peakDeckName,
      isMetaStaple,
      stapleCategories,
      stapleInclusionRate,
      stapleRecommendedCopies,
      isStapleDeficit,
    };
  });

  // Sort: HARD shortages first, SHARED shortages second, Staple Deficits with external stock third, Buyable before non-buyable, then by priceNumeric ascending
  enrichedCards.sort((a, b) => {
    const tierWeight = (item: GlobalMarketplaceCardItem) => {
      if (item.shortageTier === "HARD" && item.isBuyableShortage) return 6;
      if (item.shortageTier === "HARD") return 5;
      if (item.shortageTier === "SHARED" && item.isBuyableShortage) return 4;
      if (item.shortageTier === "SHARED") return 3;
      if (item.isStapleDeficit && item.netExternalStock > 0) return 2;
      if (item.isStapleDeficit) return 1;
      return 0;
    };
    const diffTier = tierWeight(b) - tierWeight(a);
    if (diffTier !== 0) return diffTier;

    return a.priceNumeric - b.priceNumeric;
  });

  return {
    summary: {
      totalListings: enrichedCards.length,
      totalMarketCopies,
      hardShortagesCount,
      sharedShortagesCount,
      stapleDeficitsCount,
      overpricedCount,
      heavilyOverpricedCount,
      lastSyncedAt: latestUpdatedAt,
    },
    cards: enrichedCards,
  };
}
