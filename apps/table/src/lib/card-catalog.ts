/**
 * The browser's card data client.
 *
 * The Table reads `api.gatcg.com` directly (MVP_SPEC §6.8): `/cards/all` once
 * for name → slug search, cached for seven days, then `/cards/{slug}` on demand
 * for level, life, rules text and printings. Nothing here is sent to the
 * Table server; a decklist and its art choices stay in this browser.
 */

import {
  normalizeCardName,
  type DeckCatalogCard,
  type DeckCatalogPrinting,
} from "@ga/deck-import";

export const CARD_API_BASE = "https://api.gatcg.com";
export const CARD_CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CARD_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type CardStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Bound the card API request so a hung endpoint cannot leave the deck import or
 * a Pin stuck on "loading". The timeout rejects into the existing stale-cache /
 * placeholder paths.
 */
export function fetchWithTimeout(
  fetcher: FetchLike = fetch,
  timeoutMs = 15_000
): FetchLike {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export interface CardName {
  name: string;
  slug: string;
  uuid?: string;
}

export interface CardPrinting extends DeckCatalogPrinting {
  uuid?: string;
  setName?: string;
  rarity?: number;
}

export interface CardDetail extends DeckCatalogCard {
  uuid?: string;
  editions: CardPrinting[];
}

export interface CachedCardDetail {
  detail: CardDetail;
  fetchedAt: number;
}

/** Small, replaceable cache seam so the data client is testable without IDB. */
export interface CardDetailCache {
  get(slug: string): Promise<CachedCardDetail | null>;
  set(slug: string, value: CachedCardDetail): Promise<void>;
}

interface CatalogCache {
  fetchedAt: number;
  cards: CardName[];
}

const CATALOG_STORAGE_KEY = "gt.card-catalog.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Art URLs are API-relative (`editions[].image` is e.g. `/cards/images/….jpg`);
 * absolutize them against the card API origin so `<img>` works from the Vercel
 * app origin.
 */
function imageUrl(value: unknown): string | undefined {
  const image = optionalString(value);
  if (!image) return undefined;
  return image.startsWith("http") ? image : `${CARD_API_BASE}${image}`;
}

function mapCardName(value: unknown): CardName | null {
  if (!isRecord(value)) return null;
  const name = optionalString(value.name);
  const slug = optionalString(value.slug);
  if (!name || !slug) return null;
  return { name, slug, uuid: optionalString(value.uuid) };
}

function mapPrinting(value: unknown): CardPrinting | null {
  if (!isRecord(value)) return null;
  const slug = optionalString(value.slug);
  if (!slug) return null;
  const set = isRecord(value.set) ? value.set : {};
  return {
    slug,
    uuid: optionalString(value.uuid),
    imageUrl: imageUrl(value.image),
    setPrefix: optionalString(set.prefix),
    setName: optionalString(set.name),
    collectorNumber: optionalString(value.collector_number),
    rarity: typeof value.rarity === "number" ? value.rarity : undefined,
  };
}

/** Validate one API card and flatten only the fields the Table uses. */
export function mapCardDetail(value: unknown): CardDetail | null {
  if (!isRecord(value)) return null;
  const name = optionalString(value.name);
  const slug = optionalString(value.slug);
  if (!name || !slug) return null;

  const editionsRaw = Array.isArray(value.editions) ? value.editions : [];
  const editions = editionsRaw
    .map(mapPrinting)
    .filter((printing): printing is CardPrinting => printing !== null);

  return {
    name,
    slug,
    uuid: optionalString(value.uuid),
    level: typeof value.level === "number" ? value.level : null,
    life: typeof value.life === "number" ? value.life : null,
    types: Array.isArray(value.types)
      ? value.types.filter((entry): entry is string => typeof entry === "string")
      : [],
    editions,
  };
}

function mapCardNames(value: unknown): CardName[] | null {
  if (!Array.isArray(value)) return null;
  const cards = value
    .map(mapCardName)
    .filter((card): card is CardName => card !== null);
  return cards.length === value.length && cards.length > 0 ? cards : null;
}

function readCatalogCache(storage: CardStorage | null): CatalogCache | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== "number") return null;
    const cards = mapCardNames(parsed.cards);
    return cards ? { fetchedAt: parsed.fetchedAt, cards } : null;
  } catch {
    return null;
  }
}

function writeCatalogCache(storage: CardStorage | null, value: CatalogCache): void {
  if (!storage) return;
  try {
    storage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota/private mode: the in-memory response still works for this visit.
  }
}

/**
 * Load the name index. A fresh cache wins; a network failure falls back to a
 * stale cache so the Table remains playable when `api.gatcg.com` is down.
 */
export async function loadCardCatalog(
  fetcher: FetchLike = fetch,
  storage: CardStorage | null = null,
  now: number = Date.now()
): Promise<{ cards: CardName[]; stale: boolean }> {
  const cached = readCatalogCache(storage);
  if (cached && now - cached.fetchedAt < CARD_CATALOG_TTL_MS) {
    return { cards: cached.cards, stale: false };
  }

  try {
    const response = await fetcher(`${CARD_API_BASE}/cards/all`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Card catalog request failed (${response.status})`);
    const cards = mapCardNames(await response.json());
    if (!cards) throw new Error("Card catalog returned an unexpected response");
    writeCatalogCache(storage, { fetchedAt: now, cards });
    return { cards, stale: false };
  } catch (error) {
    if (cached) return { cards: cached.cards, stale: true };
    throw error;
  }
}

/**
 * Rank name search: prefix first, then a word prefix, then anywhere in the
 * name, then the slug. Accents and case are folded by `normalizeCardName`.
 */
export function searchCardNames(
  cards: readonly CardName[],
  query: string,
  limit = 20
): CardName[] {
  const normalized = normalizeCardName(query);
  if (!normalized) return [];

  const ranked = cards
    .map((card) => {
      const name = normalizeCardName(card.name);
      const slug = card.slug.toLowerCase();
      let rank = 4;
      if (name.startsWith(normalized)) rank = 0;
      else if (name.split(" ").some((word) => word.startsWith(normalized))) rank = 1;
      else if (name.includes(normalized)) rank = 2;
      else if (slug.includes(normalized)) rank = 3;
      return { card, rank, name };
    })
    .filter((entry) => entry.rank < 4)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  return ranked.slice(0, limit).map((entry) => entry.card);
}

/**
 * Fetch one card's full detail, preferring a fresh cache. Network or shape
 * failures return stale cached detail when possible, then `null`; callers draw
 * a placeholder instead of taking the Table down.
 */
export async function getCardDetail(
  slug: string,
  fetcher: FetchLike,
  cache: CardDetailCache,
  now: number = Date.now()
): Promise<CardDetail | null> {
  if (!slug) return null;
  const cached = await cache.get(slug);
  if (cached && now - cached.fetchedAt < CARD_DETAIL_TTL_MS) return cached.detail;

  try {
    const response = await fetcher(
      `${CARD_API_BASE}/cards/${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`Card detail request failed (${response.status})`);
    const detail = mapCardDetail(await response.json());
    if (!detail || detail.slug !== slug) {
      throw new Error("Card detail returned an unexpected response");
    }
    await cache.set(slug, { detail, fetchedAt: now });
    return detail;
  } catch {
    return cached?.detail ?? null;
  }
}