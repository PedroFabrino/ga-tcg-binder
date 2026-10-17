import { eq, sql } from "drizzle-orm";
import { metaStaples, cards } from "../db/schema";

export interface ParsedMetaStaple {
  cardSlug: string;
  cardName: string;
  categories: string[];
  primaryCategory: string;
  element: string;
  inclusionRate: string;
  avgCopies: string;
  recommendedCopies: number;
  deckCount: number;
  imageUrl?: string;
}

export function parseStaplesHtml(html: string): ParsedMetaStaple[] {
  const intermediateMap = new Map<
    string,
    {
      cardName: string;
      categories: Set<string>;
      categoryInclusion: Map<string, number>;
      maxInclusionNum: number;
      maxAvgCopiesNum: number;
      deckCount: number;
      imageUrl?: string;
    }
  >();

  // Split by section or iterate matches
  // A section typically starts with <h2 class="...section-title...">Section Name</h2>
  const sectionRegex = /<h\d[^>]*class=["'][^"']*section-title[^"']*["'][^>]*>([\s\S]*?)<\/h\d>/gi;
  const sections: { title: string; startIndex: number }[] = [];
  let secMatch: RegExpExecArray | null;

  while ((secMatch = sectionRegex.exec(html)) !== null) {
    const rawTitle = secMatch[1].replace(/<[^>]+>/g, "").trim();
    sections.push({ title: rawTitle, startIndex: secMatch.index });
  }

  // Helper to determine which section an index belongs to
  const getSectionForIndex = (index: number): string => {
    let current = "Meta Staples";
    for (const sec of sections) {
      if (index >= sec.startIndex) {
        current = sec.title;
      } else {
        break;
      }
    }
    return current;
  };

  // Find all card tiles: <div class="...gt-card-tile..." ...>...</div>
  // Could be .gt-card-tile or .staple-card or similar
  const tileRegex = /<div[^>]*class=["']([^"']*gt-card-tile[^"']*)["']([^>]*)>([\s\S]*?)<\/div>/gi;
  let tileMatch: RegExpExecArray | null;

  while ((tileMatch = tileRegex.exec(html)) !== null) {
    const classAttr = tileMatch[1];
    const otherAttrs = tileMatch[2];
    const innerHtml = tileMatch[3];
    const tileIndex = tileMatch.index;

    // Filter out low-sample tiles
    if (classAttr.includes("low-n")) {
      continue;
    }

    const currentSection = getSectionForIndex(tileIndex);

    // Extract card name
    let cardName = "";
    const dataNameMatch = otherAttrs.match(/data-card-name=["']([^"']+)["']/i);
    if (dataNameMatch) {
      cardName = dataNameMatch[1].trim();
    } else {
      const nameTagMatch =
        innerHtml.match(/class=["'][^"']*(?:card-name|card-link)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|a)>/i) ||
        innerHtml.match(/<a[^>]*href=["'][^"']*\/cards\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
      if (nameTagMatch) {
        cardName = nameTagMatch[1].replace(/<[^>]+>/g, "").trim();
      }
    }

    if (!cardName) continue;

    // Extract inclusion rate
    let inclusionRateStr = "0%";
    let inclusionNum = 0;
    const dataIncMatch = otherAttrs.match(/data-inclusion=["']([^"']+)["']/i);
    if (dataIncMatch) {
      inclusionRateStr = dataIncMatch[1].trim();
    } else {
      const incMatch = innerHtml.match(/class=["'][^"']*stat-inclusion[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
        innerHtml.match(/(\d+(?:\.\d+)?)\s*%/);
      if (incMatch) {
        inclusionRateStr = incMatch[1].replace(/<[^>]+>/g, "").trim();
        if (!inclusionRateStr.endsWith("%")) inclusionRateStr += "%";
      }
    }
    const incParsed = parseFloat(inclusionRateStr.replace("%", ""));
    if (!isNaN(incParsed)) {
      inclusionNum = incParsed;
    }

    // Filter out < 2.0% inclusion
    if (inclusionNum < 2.0) {
      continue;
    }

    // Extract avg copies
    let avgCopiesStr = "1.0";
    let avgCopiesNum = 1.0;
    const dataAvgMatch = otherAttrs.match(/data-avg-copies=["']([^"']+)["']/i);
    if (dataAvgMatch) {
      avgCopiesStr = dataAvgMatch[1].trim();
    } else {
      const avgMatch = innerHtml.match(/class=["'][^"']*stat-copies[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
        innerHtml.match(/(\d+(?:\.\d+)?)\s*(?:avg|copies)/i);
      if (avgMatch) {
        avgCopiesStr = avgMatch[1].replace(/<[^>]+>/g, "").trim().replace(/[^\d.]/g, "");
      }
    }
    const avgParsed = parseFloat(avgCopiesStr);
    if (!isNaN(avgParsed)) {
      avgCopiesNum = avgParsed;
    }

    // Extract deck count
    let deckCount = 0;
    const dataDecksMatch = otherAttrs.match(/data-decks=["']([^"']+)["']/i);
    if (dataDecksMatch) {
      deckCount = parseInt(dataDecksMatch[1], 10) || 0;
    }

    // Extract image URL
    let imageUrl: string | undefined = undefined;
    const imgMatch = innerHtml.match(/<img[^>]*src=["']([^"']+)["']/i);
    if (imgMatch) {
      imageUrl = imgMatch[1];
    }

    // Group by normalized name
    const normKey = cardName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = intermediateMap.get(normKey);

    if (existing) {
      existing.categories.add(currentSection);
      existing.categoryInclusion.set(
        currentSection,
        Math.max(existing.categoryInclusion.get(currentSection) || 0, inclusionNum)
      );
      if (inclusionNum > existing.maxInclusionNum) {
        existing.maxInclusionNum = inclusionNum;
      }
      if (avgCopiesNum > existing.maxAvgCopiesNum) {
        existing.maxAvgCopiesNum = avgCopiesNum;
      }
      existing.deckCount = Math.max(existing.deckCount, deckCount);
      if (!existing.imageUrl && imageUrl) {
        existing.imageUrl = imageUrl;
      }
    } else {
      const catSet = new Set<string>();
      catSet.add(currentSection);
      const catInc = new Map<string, number>();
      catInc.set(currentSection, inclusionNum);

      intermediateMap.set(normKey, {
        cardName,
        categories: catSet,
        categoryInclusion: catInc,
        maxInclusionNum: inclusionNum,
        maxAvgCopiesNum: avgCopiesNum,
        deckCount,
        imageUrl,
      });
    }
  }

  // Convert map to ParsedMetaStaple array
  const results: ParsedMetaStaple[] = [];

  for (const entry of Array.from(intermediateMap.values())) {
    const slug = entry.cardName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const categoriesArray: string[] = Array.from(entry.categories);

    // Determine primary category (highest inclusion)
    let primaryCategory: string = categoriesArray[0] || "Meta Staples";
    let maxCatInc = -1;
    for (const [cat, inc] of Array.from(entry.categoryInclusion.entries())) {
      if (inc > maxCatInc) {
        maxCatInc = inc;
        primaryCategory = cat;
      }
    }

    // Element detection from categories or card name
    let element = "NORM";
    const lowerCats = categoriesArray.map((c) => c.toLowerCase()).join(" ");
    if (lowerCats.includes("water")) element = "WATER";
    else if (lowerCats.includes("fire")) element = "FIRE";
    else if (lowerCats.includes("wind")) element = "WIND";
    else if (lowerCats.includes("earth")) element = "EARTH";
    else if (lowerCats.includes("lightning")) element = "LIGHTNING";

    // Recommended copies:
    // If only in Divine Relics or Material Deck: 1
    // Else Math.min(4, Math.max(1, Math.ceil(maxAvgCopiesNum)))
    const isMaterialOnly = categoriesArray.every(
      (c) =>
        c.toLowerCase().includes("divine relics") ||
        c.toLowerCase().includes("material deck") ||
        c.toLowerCase().includes("relic")
    );

    let recommendedCopies = 1;
    if (!isMaterialOnly) {
      recommendedCopies = Math.min(4, Math.max(1, Math.ceil(entry.maxAvgCopiesNum)));
    }

    results.push({
      cardSlug: slug,
      cardName: entry.cardName,
      categories: categoriesArray,
      primaryCategory,
      element,
      inclusionRate: `${entry.maxInclusionNum.toFixed(1).replace(/\.0$/, "")}%`,
      avgCopies: `${entry.maxAvgCopiesNum.toFixed(1)}`,
      recommendedCopies,
      deckCount: entry.deckCount,
      imageUrl: entry.imageUrl,
    });
  }

  return results;
}

export async function syncMetaStaples(
  database: any,
  customFetch: typeof fetch = fetch
): Promise<{ syncedCount: number }> {
  const url = "https://grandarchivestats.com/cards/staples?window=60";
  const res = await customFetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch staples from ${url}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const parsedStaples = parseStaplesHtml(html);

  if (parsedStaples.length === 0) {
    return { syncedCount: 0 };
  }

  // Upsert into meta_staples table
  let synced = 0;
  for (const staple of parsedStaples) {
    // Resolve slug from cards catalog if possible
    let targetSlug = staple.cardSlug;
    const matchedCard = await database
      .select()
      .from(cards)
      .where(sql`lower(${cards.name}) = lower(${staple.cardName})`)
      .get();

    if (matchedCard) {
      targetSlug = matchedCard.slug;
    } else {
      // Ensure card stub exists so foreign key is satisfied
      await database
        .insert(cards)
        .values({
          slug: targetSlug,
          name: staple.cardName,
          element: staple.element,
          class: "ALL",
          type: staple.recommendedCopies === 1 ? "REGALIA" : "ACTION",
          subtypes: "[]",
        })
        .onConflictDoNothing();
    }

    await database
      .insert(metaStaples)
      .values({
        cardSlug: targetSlug,
        cardName: staple.cardName,
        categories: JSON.stringify(staple.categories),
        primaryCategory: staple.primaryCategory,
        element: staple.element,
        inclusionRate: staple.inclusionRate,
        avgCopies: staple.avgCopies,
        recommendedCopies: staple.recommendedCopies,
        deckCount: staple.deckCount,
        imageUrl: staple.imageUrl || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: metaStaples.cardSlug,
        set: {
          cardName: staple.cardName,
          categories: JSON.stringify(staple.categories),
          primaryCategory: staple.primaryCategory,
          element: staple.element,
          inclusionRate: staple.inclusionRate,
          avgCopies: staple.avgCopies,
          recommendedCopies: staple.recommendedCopies,
          deckCount: staple.deckCount,
          imageUrl: staple.imageUrl || null,
          updatedAt: new Date(),
        },
      });

    synced++;
  }

  return { syncedCount: synced };
}

export async function getMetaStaples(database: any) {
  return await database.select().from(metaStaples).all();
}
