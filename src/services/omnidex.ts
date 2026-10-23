import { decodeHtmlEntities, parseOmnidexText as parseDecklistText } from "@ga/deck-import";
import type { ParsedDecklist } from "@ga/deck-import";

export { decodeHtmlEntities } from "@ga/deck-import";
export type { ParsedDeckCard, ParsedDecklist } from "@ga/deck-import";

/**
 * Legacy collection-app wrapper.
 *
 * The shared parser is purely structural: GrandTable resolves the true Champion
 * from the Material-deck card whose printed `level` is 0 (`resolveDecklist`).
 * The collection app's meta ingestion still expects the historical
 * first-Material-line hint, so keep that behaviour isolated here rather than
 * teaching the shared parser the old rule.
 */
export function parseOmnidexText(
  rawText: string
): ParsedDecklist & { champion?: string } {
  const parsed = parseDecklistText(rawText);
  return { ...parsed, champion: parsed.material[0]?.name };
}

export function serializeOmnidexText(deck: {
  material: { name: string; quantity: number }[];
  main: { name: string; quantity: number }[];
  side: { name: string; quantity: number }[];
}): string {
  const sections: string[] = [];

  if (deck.material.length > 0) {
    sections.push("# Material Deck");
    for (const card of deck.material) {
      sections.push(`${card.quantity} ${card.name}`);
    }
    sections.push("");
  }

  if (deck.main.length > 0) {
    sections.push("# Main Deck");
    for (const card of deck.main) {
      sections.push(`${card.quantity} ${card.name}`);
    }
    sections.push("");
  }

  if (deck.side.length > 0) {
    sections.push("# Sideboard");
    for (const card of deck.side) {
      sections.push(`${card.quantity} ${card.name}`);
    }
  }

  return sections.join("\n").trim();
}

export async function fetchDeckFromUrl(url: string): Promise<{
  name: string;
  champion?: string;
  decklist: string;
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch deck from URL (${res.status} ${res.statusText})`);
  }

  const html = await res.text();

  // Try extracting from <textarea id="omnidex-src" ...> or class="omnidex-src" (grandarchivestats.com)
  const textareaMatch =
    html.match(/<textarea[^>]*id=["']omnidex-src["'][^>]*>([\s\S]*?)<\/textarea>/i) ||
    html.match(/<textarea[^>]*class=["'][^"']*omnidex-src[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/i);

  let rawDecklist = "";
  if (textareaMatch) {
    rawDecklist = decodeHtmlEntities(textareaMatch[1].trim());
  } else {
    // Try pre / code block
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch && (preMatch[1].includes("# Main") || preMatch[1].includes("# Material"))) {
      rawDecklist = decodeHtmlEntities(preMatch[1].trim());
    } else {
      // General heading match
      const headingMatch = html.match(
        /(?:#|\/\/)?\s*Material(?:\s+Deck)?[\s\S]*?(?:#|\/\/)?\s*Main(?:\s+Deck)?[\s\S]*/i
      );
      if (headingMatch) {
        rawDecklist = decodeHtmlEntities(headingMatch[0].replace(/<[^>]+>/g, "\n").trim());
      }
    }
  }

  if (!rawDecklist) {
    throw new Error("Could not extract a valid decklist from this URL. Please verify the URL or paste the Omnidex text snippet directly.");
  }

  // Extract deck title
  let name = "Imported Meta Deck";
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const title = html.match(/<title>([^<]+)<\/title>/i);
  if (ogTitle) {
    name = decodeHtmlEntities(ogTitle[1].replace(/\s*-\s*Grand Archive.*$/i, "").trim());
  } else if (title) {
    name = decodeHtmlEntities(title[1].replace(/\s*-\s*Grand Archive.*$/i, "").trim());
  }

  const parsed = parseOmnidexText(rawDecklist);

  return {
    name,
    champion: parsed.champion,
    decklist: rawDecklist,
  };
}
