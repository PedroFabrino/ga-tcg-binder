/**
 * Omnidex / GrandArchiveStats decklist parsing for GrandTable.
 *
 * This is the `parseOmnidexText` implementation from the collection app,
 * copied into the standalone Table app (ADR-0004) and corrected per
 * `MVP_SPEC.md` §6.6: the parser never guesses a Champion from the first
 * Material line, and name resolution is a separate, catalog-aware step so
 * unresolved names can be reported instead of silently disappearing.
 */

export type DeckZone = "main" | "material" | "side";

export interface ParsedDeckCard {
  name: string;
  quantity: number;
  collectorCode?: string;
}

export interface ParsedDecklist {
  main: ParsedDeckCard[];
  material: ParsedDeckCard[];
  side: ParsedDeckCard[];
}

/** The subset of a catalog Card the Table needs for name resolution and Pins. */
export interface DeckCatalogPrinting {
  /** The printing's canonical slug, stored as `Pin.printingSlug`. */
  slug: string;
  setPrefix?: string;
  collectorNumber?: string;
  imageUrl?: string;
}

export interface DeckCatalogCard {
  name: string;
  slug: string;
  /** Printed level; 0 identifies the Champion in the Material Deck. */
  level?: number | null;
  life?: number | null;
  types?: string[];
  editions?: DeckCatalogPrinting[];
}

export interface ResolvedDeckCard extends ParsedDeckCard {
  card: DeckCatalogCard | null;
}

export type DeckImportWarning =
  | {
      code: "unresolvedCard";
      name: string;
      zones: DeckZone[];
      quantity: number;
    }
  | { code: "championMissing" }
  | { code: "championAmbiguous"; names: string[] };

export interface ResolvedDecklist {
  main: ResolvedDeckCard[];
  material: ResolvedDeckCard[];
  side: ResolvedDeckCard[];
  /**
   * The first resolved Material card with printed level 0. A normal deck has
   * one; if the list has several, the first is used and a warning explains the
   * ambiguity rather than silently choosing the first Material line.
   */
  champion: ResolvedDeckCard | null;
  warnings: DeckImportWarning[];
}

const MATERIAL_HEADERS = ["# material", "// material"];
const MAIN_HEADERS = ["# main", "// main"];
const SIDE_HEADERS = ["# sideboard", "# side", "// side", "// sideboard"];

function isZoneHeader(line: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => line.startsWith(prefix));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

/**
 * Parse the pasteable Omnidex format. A line is a card only when it has a
 * leading quantity; headers and comments are ignored. No Champion is inferred
 * here: resolution belongs to `resolveDecklist`, which can see printed levels.
 */
export function parseOmnidexText(rawText: string): ParsedDecklist {
  const result: ParsedDecklist = { main: [], material: [], side: [] };
  const decodedText = decodeHtmlEntities(rawText || "");
  let currentZone: DeckZone = "main";

  for (const rawLine of decodedText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    if (isZoneHeader(lower, MATERIAL_HEADERS) || lower === "material" || lower === "material deck") {
      currentZone = "material";
      continue;
    }
    if (isZoneHeader(lower, MAIN_HEADERS) || lower === "main" || lower === "main deck") {
      currentZone = "main";
      continue;
    }
    if (
      isZoneHeader(lower, SIDE_HEADERS) ||
      lower === "sideboard" ||
      lower === "side" ||
      lower === "side deck"
    ) {
      currentZone = "side";
      continue;
    }
    if (line.startsWith("#") || line.startsWith("//")) continue;

    const match = line.match(/^(\d+)[xX]?\s+(.+)$/);
    if (!match) continue;

    const quantity = parseInt(match[1], 10);
    let cardName = decodeHtmlEntities(match[2].trim());
    let collectorCode: string | undefined;

    // Extract a trailing Omnidex printing hint like "(DOA 1st 001)" or
    // "[ALC 042]". It is display metadata, never the canonical card identity.
    const codeMatch = cardName.match(/[\(\[]([A-Za-z0-9\s\-]+)[\)\]]$/);
    if (codeMatch) {
      collectorCode = codeMatch[1].trim();
      cardName = cardName.replace(/[\(\[][A-Za-z0-9\s\-]+[\)\]]$/, "").trim();
    }

    result[currentZone].push({
      name: decodeHtmlEntities(cardName),
      quantity,
      collectorCode,
    });
  }

  return result;
}

/**
 * Fold a catalog name into a stable comparison key: case, accents and curly
 * apostrophes must not decide whether a pasted name resolves.
 */
export function normalizeCardName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A name → card lookup; duplicate names keep the first catalog entry. */
export function buildDeckLookup(
  cards: readonly DeckCatalogCard[]
): (name: string) => DeckCatalogCard | undefined {
  const byName = new Map<string, DeckCatalogCard>();
  for (const card of cards) {
    const key = normalizeCardName(card.name);
    if (!byName.has(key)) byName.set(key, card);
  }
  return (name) => byName.get(normalizeCardName(name));
}

/**
 * Resolve every parsed line against the catalog, preserving unresolved lines.
 * The Champion is the first Material entry whose resolved printed level is 0.
 * The first level-0 card is deterministic for the fixture lists exported by
 * Silvie/GrandArchiveStats, which can contain several Champion printings.
 */
export function resolveDecklist(
  parsed: ParsedDecklist,
  lookup: (name: string) => DeckCatalogCard | undefined
): ResolvedDecklist {
  const unresolved = new Map<
    string,
    { name: string; zones: Set<DeckZone>; quantity: number }
  >();

  const resolveZone = (zone: DeckZone): ResolvedDeckCard[] =>
    parsed[zone].map((entry) => {
      const card = lookup(entry.name) ?? null;
      if (!card) {
        const key = normalizeCardName(entry.name);
        const current = unresolved.get(key);
        if (current) {
          current.zones.add(zone);
          current.quantity += entry.quantity;
        } else {
          unresolved.set(key, {
            name: entry.name,
            zones: new Set([zone]),
            quantity: entry.quantity,
          });
        }
      }
      return { ...entry, card };
    });

  const resolved: ResolvedDecklist = {
    main: resolveZone("main"),
    material: resolveZone("material"),
    side: resolveZone("side"),
    champion: null,
    warnings: [],
  };

  const levelZero = resolved.material.filter((entry) => entry.card?.level === 0);
  resolved.champion = levelZero[0] ?? null;

  resolved.warnings = [...unresolved.values()].map((entry) => ({
    code: "unresolvedCard" as const,
    name: entry.name,
    zones: [...entry.zones],
    quantity: entry.quantity,
  }));

  if (!resolved.champion) {
    resolved.warnings.push({ code: "championMissing" });
  } else if (levelZero.length > 1) {
    resolved.warnings.push({
      code: "championAmbiguous",
      names: levelZero.map((entry) => entry.name),
    });
  }

  return resolved;
}
