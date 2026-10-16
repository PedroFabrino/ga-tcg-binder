import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  mypCards,
} from "../db/schema";

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
}

export interface MarketplaceSummary {
  totalListings: number;
  totalCopies: number;
  totalValueBrl: number;
  shortageOffsetCount: number;
  shortageOffsetCopies: number;
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

  // 1. Fetch Page 1
  const page1Url = `https://mypcards.com/${encodeURIComponent(username)}`;
  const p1Html = await fetchMypText(page1Url, customFetch);
  const parsedItems: ParsedMypItem[] = [...parseMypHtml(p1Html)];

  // 2. Fetch subsequent pages via /usuario/load-more
  let page = 2;
  const maxPages = 35; // up to ~1050 listings safety cap
  while (page <= maxPages) {
    const moreUrl = `https://mypcards.com/usuario/load-more?nick=${encodeURIComponent(
      username
    )}&page=${page}`;
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

  // 3. Resolve against local Catalog
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

  let matchedCount = 0;
  let unmatchedCount = 0;

  // Wipe previous MyP snapshot for this user
  await database.delete(mypCards).where(eq(mypCards.userId, userId));

  const rowsToInsert: any[] = [];
  const batchTimestamp = Date.now();

  for (let idx = 0; idx < parsedItems.length; idx++) {
    const item = parsedItems[idx];
    const lowerClean = item.cleanName.toLowerCase().trim();

    let matchedCard = cardByLowerName.get(lowerClean);

    // Fallback 1: Double-faced card split on `//`
    if (!matchedCard && lowerClean.includes("//")) {
      const frontFace = lowerClean.split("//")[0].trim();
      matchedCard = cardByLowerName.get(frontFace);
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
      const edByNum = allCatalogEditions.find(
        (e: any) =>
          e.setPrefix.toUpperCase() === parsedSet &&
          e.collectorNumber.padStart(3, "0") === parsedNum!.padStart(3, "0")
      );
      if (edByNum) {
        matchedCard = allCatalogCards.find((c: any) => c.slug === edByNum.cardSlug);
      }
    }

    // Fallback 3: Alphanumeric normalized match
    if (!matchedCard) {
      const alpha = lowerClean.split("//")[0].replace(/[^a-z0-9]/g, "");
      matchedCard = cardByAlphaNum.get(alpha);
    }

    let editionId: string | null = null;
    if (matchedCard) {
      matchedCount++;
      const edsForSlug = allCatalogEditions.filter(
        (e: any) => e.cardSlug === matchedCard!.slug
      );
      const exactEd =
        edsForSlug.find(
          (e: any) => e.setPrefix.toUpperCase() === item.setPrefix.toUpperCase()
        ) ||
        edsForSlug.find((e: any) => e.setPrefix.toUpperCase() === parsedSet) ||
        edsForSlug[0];
      editionId = exactEd?.id || null;
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

export async function getUserMarketplaceReport(
  userId: string,
  database: any = db
): Promise<MarketplaceReport> {
  let effectiveUserId = userId;
  const userRows = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let mypUsername: string | null = userRows[0]?.mypUsername || null;

  if (userRows.length === 0) {
    const anyUser = await database.select().from(users).limit(1);
    if (anyUser.length > 0) {
      effectiveUserId = anyUser[0].id;
      mypUsername = anyUser[0].mypUsername || null;
    }
  }

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

  // Fetch user binder inventory
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

  let totalCopies = 0;
  let totalValueBrl = 0;
  let shortageOffsetCount = 0;
  let shortageOffsetCopies = 0;

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

    if (isShortageOffset) {
      shortageOffsetCount++;
      shortageOffsetCopies += Math.min(qty, concurrentMissing);
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
    };
  });

  // Sort: Shortage offsets first, then by price descending
  enrichedCards.sort((a, b) => {
    if (a.isShortageOffset !== b.isShortageOffset) {
      return a.isShortageOffset ? -1 : 1;
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
  let effectiveUserId = userId;
  const rows = await database
    .select()
    .from(mypCards)
    .where(eq(mypCards.id, mypCardId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Marketplace listing not found.");
  }

  const listing = rows[0];
  effectiveUserId = listing.userId;

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

  // 1. Upsert into collection_items (Binder)
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

  if (existingBinder.length > 0) {
    const newQty = Number(existingBinder[0].quantity) + claimQty;
    await database
      .update(collectionItems)
      .set({
        quantity: newQty,
        updatedAt: sql`(strftime('%s', 'now'))`,
      })
      .where(eq(collectionItems.id, existingBinder[0].id));
  } else {
    await database.insert(collectionItems).values({
      id: `ci-myp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: effectiveUserId,
      editionId,
      foil: foilFlag,
      quantity: claimQty,
      isDedicated: false,
    });
  }

  // 2. Decrement or delete from myp_cards
  const remaining = Number(listing.quantity) - claimQty;
  if (remaining <= 0) {
    await database.delete(mypCards).where(eq(mypCards.id, listing.id));
  } else {
    await database
      .update(mypCards)
      .set({
        quantity: remaining,
        updatedAt: sql`(strftime('%s', 'now'))`,
      })
      .where(eq(mypCards.id, listing.id));
  }

  return {
    success: true,
    claimedQuantity: claimQty,
    editionId,
    mypProductUrl: listing.mypProductUrl || null,
  };
}
