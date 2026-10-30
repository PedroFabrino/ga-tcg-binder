import type {
  DeckAdvisorCandidateCard,
  DeckAdvisorDeckCardSnapshot,
  DeckAdvisorMetaComparison,
  DeckAdvisorContextSnapshot,
  DeckAdvisorAcquisitionTier,
} from "@ga/contracts";
import type {
  DeckAdvisorRawDeckData,
  DeckAdvisorRawUserData,
} from "../db/repositories/deck-advisor-repository";
import {
  aggregateUserHoldingsBySlug,
  parseCardSubtypes,
} from "./deck-advisor-inventory";
import { parseOmnidexText } from "./omnidex";

/**
 * Checks if user is allowlisted via environment variables.
 */
export function isUserAdvisorAllowlisted(user: { id?: string | null; email?: string | null }): boolean {
  const allowedEmailsRaw = process.env.ADVISOR_ALLOWED_EMAILS || "";
  const allowedUserIdsRaw = process.env.ADVISOR_ALLOWED_USER_IDS || "";

  const allowedEmails = allowedEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const allowedUserIds = allowedUserIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (allowedEmails.length === 0 && allowedUserIds.length === 0) {
    return false;
  }

  if (user.email && allowedEmails.includes(user.email.trim().toLowerCase())) {
    return true;
  }

  if (user.id && allowedUserIds.includes(user.id.trim())) {
    return true;
  }

  return false;
}

/**
 * Detects legality effect bypasses in card text.
 * e.g. "Ignore the elemental requirements of Distortion cards you play" -> "DISTORTION"
 */
export function detectSubtypeLegalityBypasses(
  deckCards: Array<{ name: string | null; effect: string | null }>
): Array<{ subtype: string; unlockedByCard: string }> {
  const bypasses: Array<{ subtype: string; unlockedByCard: string }> = [];
  const regex = /ignore the elemental requirements of ([a-z0-9 -]+) cards/gi;

  for (const card of deckCards) {
    if (!card.effect) continue;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(card.effect)) !== null) {
      const rawSubtype = match[1].trim().toUpperCase();
      if (rawSubtype) {
        bypasses.push({
          subtype: rawSubtype,
          unlockedByCard: card.name || "Unknown Card",
        });
      }
    }
  }

  return bypasses;
}

/**
 * Assembles the full grounded Deck Advisor context.
 */
export function assembleDeckAdvisorContext(params: {
  deckData: DeckAdvisorRawDeckData;
  userData: DeckAdvisorRawUserData;
  metaBenchmarks: {
    archetypes: Array<{
      id: string;
      name: string;
      tier: string;
      champion: string;
      element: string | null;
      shareRate: string;
      winRate: string;
      decklist: string;
    }>;
    staples: Array<{
      cardSlug: string;
      cardName: string;
      recommendedCopies: number;
    }>;
    catalogCards?: Array<{
      slug: string;
      name: string;
      element: string;
      class: string;
      type: string;
      subtypes: string;
      effect: string | null;
      costReserve: number | null;
      costMemory: number | null;
      speed: boolean | null;
    }>;
  };
}): DeckAdvisorContextSnapshot {
  const { deck, deckCards } = params.deckData;

  // 1. Unlocked Elements from Deck (Only Material and Main decks unlock elements)
  const unlockedElementsSet = new Set<string>(["NORM"]);
  const activeChampionClassesSet = new Set<string>();

  for (const c of deckCards) {
    if ((c.zone === "material" || c.zone === "main") && c.element) {
      unlockedElementsSet.add(c.element.toUpperCase());
    }
    if (c.zone === "material" && c.type?.toUpperCase() === "CHAMPION" && c.class) {
      activeChampionClassesSet.add(c.class.toUpperCase());
    }
  }

  // 2. Subtype Bypasses
  const bypassedSubtypes = detectSubtypeLegalityBypasses(deckCards);
  const bypassedSubtypesSet = new Set(bypassedSubtypes.map((b) => b.subtype.toUpperCase()));

  // 3. User Holdings aggregation
  const holdings = aggregateUserHoldingsBySlug(params.userData, deck.id);

  // 4. Deck Card Snapshots with accurate Hard & Shared Shortages
  const deckCardSnapshots: DeckAdvisorDeckCardSnapshot[] = deckCards.map((c) => {
    const parsedSubtypes = parseCardSubtypes(c.subtypes, c.name || c.cardSlug);
    const holding = holdings.get(c.cardSlug);
    const availableOwned = holding?.ownedQuantity || 0;
    const idleQuantity = holding?.idleQuantity || 0;

    const hardShortage = Math.max(0, c.quantity - availableOwned);
    const sharedShortage = Math.max(0, Math.min(c.quantity, availableOwned) - idleQuantity);

    return {
      id: c.id,
      cardSlug: c.cardSlug,
      cardName: c.name || c.cardSlug,
      zone: (c.zone as "material" | "main" | "side") || "main",
      quantity: c.quantity,
      element: c.element || "NORM",
      class: c.class || "ALL",
      type: c.type || "UNKNOWN",
      subtypes: parsedSubtypes,
      effect: c.effect || "",
      costReserve: c.costReserve,
      costMemory: c.costMemory,
      speed: c.speed,
      hardShortage,
      sharedShortage,
    };
  });

  // 5. Build Candidate Pool (Tier 1 Binder & Tier 2 Store Pullback)
  const candidatePool: DeckAdvisorCandidateCard[] = [];
  const candidateSlugs = new Set<string>();

  for (const entry of Array.from(holdings.values())) {
    // Skip if user owns 0 available copies and 0 store copies (e.g. all copies dedicated to other decks)
    if (entry.ownedQuantity === 0 && entry.storeQuantity === 0) {
      continue;
    }

    const isElementLegal = unlockedElementsSet.has(entry.element.toUpperCase());
    const isBypassed = entry.subtypes.some((st) => bypassedSubtypesSet.has(st.toUpperCase()));

    if (!isElementLegal && !isBypassed) {
      continue;
    }

    const isClassMatching =
      activeChampionClassesSet.size === 0 ||
      entry.class.toUpperCase() === "ALL" ||
      entry.class.toUpperCase() === "GENERIC" ||
      activeChampionClassesSet.has(entry.class.toUpperCase());

    let unlockReason: string | undefined = undefined;
    if (!isElementLegal && isBypassed) {
      const match = bypassedSubtypes.find((b) =>
        entry.subtypes.some((st) => st.toUpperCase() === b.subtype.toUpperCase())
      );
      if (match) {
        unlockReason = match.unlockedByCard;
      }
    }

    const tier: DeckAdvisorAcquisitionTier =
      entry.ownedQuantity > 0 ? "binder_available" : "store_pullback";

    candidatePool.push({
      cardSlug: entry.cardSlug,
      cardName: entry.name,
      element: entry.element,
      class: entry.class,
      type: entry.type,
      subtypes: entry.subtypes,
      effect: entry.effect,
      costReserve: entry.costReserve,
      costMemory: entry.costMemory,
      speed: entry.speed,
      tier,
      ownedQuantity: entry.ownedQuantity,
      idleQuantity: entry.idleQuantity,
      sharedQuantity: entry.sharedQuantity,
      storeQuantity: entry.storeQuantity,
      isDedicatedToOtherDeck: entry.isDedicatedToOtherDeck,
      unlockedViaReason: unlockReason,
      classBonusActive: isClassMatching,
    });
    candidateSlugs.add(entry.cardSlug);
  }

  // 6. Meta Benchmarking & Tier 3 (unowned_upgrade) Candidate Ingestion
  let metaComparison: DeckAdvisorMetaComparison | null = null;
  const deckChampion = deck.champion || "";

  const matchingArchetype = params.metaBenchmarks.archetypes.find((a) => {
    if (deckChampion) {
      const dc = deckChampion.toLowerCase();
      const ac = a.champion.toLowerCase();
      if (ac.includes(dc) || dc.includes(ac)) return true;
      if (a.name.toLowerCase().includes(dc)) return true;
    }
    return false;
  }) || params.metaBenchmarks.archetypes[0];

  if (matchingArchetype) {
    const missingStaples: DeckAdvisorMetaComparison["missingStaples"] = [];
    const catalogCardsMap = new Map<string, NonNullable<typeof params.metaBenchmarks.catalogCards>[0]>();
    for (const c of params.metaBenchmarks.catalogCards || []) {
      catalogCardsMap.set(c.slug, c);
    }

    // A. Evaluate format staples
    for (const staple of params.metaBenchmarks.staples) {
      const held = holdings.get(staple.cardSlug);
      const totalOwned = (held?.ownedQuantity || 0) + (held?.storeQuantity || 0);
      if (totalOwned < staple.recommendedCopies) {
        missingStaples.push({
          cardSlug: staple.cardSlug,
          cardName: staple.cardName,
          recommendedCopies: staple.recommendedCopies,
          ownedCopies: totalOwned,
          deficit: staple.recommendedCopies - totalOwned,
        });

        // Add to candidate pool as Tier 3 unowned upgrade if completely unowned
        if (!candidateSlugs.has(staple.cardSlug) && catalogCardsMap.has(staple.cardSlug)) {
          const cat = catalogCardsMap.get(staple.cardSlug)!;
          const isElementLegal = unlockedElementsSet.has(cat.element.toUpperCase());
          const catSubtypes = parseCardSubtypes(cat.subtypes, cat.name);
          const isBypassed = catSubtypes.some((st) => bypassedSubtypesSet.has(st.toUpperCase()));

          if (isElementLegal || isBypassed) {
            candidatePool.push({
              cardSlug: cat.slug,
              cardName: cat.name,
              element: cat.element,
              class: cat.class,
              type: cat.type,
              subtypes: catSubtypes,
              effect: cat.effect || "",
              costReserve: cat.costReserve,
              costMemory: cat.costMemory,
              speed: cat.speed,
              tier: "unowned_upgrade",
              ownedQuantity: 0,
              idleQuantity: 0,
              sharedQuantity: 0,
              storeQuantity: 0,
              classBonusActive:
                activeChampionClassesSet.size === 0 ||
                cat.class.toUpperCase() === "ALL" ||
                cat.class.toUpperCase() === "GENERIC" ||
                activeChampionClassesSet.has(cat.class.toUpperCase()),
            });
            candidateSlugs.add(cat.slug);
          }
        }
      }
    }

    // B. Evaluate Canonical Decklist of the matching archetype
    if (matchingArchetype.decklist) {
      try {
        const parsedDecklist = parseOmnidexText(matchingArchetype.decklist);
        const archetypeCards = [
          ...parsedDecklist.material,
          ...parsedDecklist.main,
          ...parsedDecklist.side,
        ];

        for (const ac of archetypeCards) {
          const slug = ac.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          if (!candidateSlugs.has(slug) && catalogCardsMap.has(slug)) {
            const cat = catalogCardsMap.get(slug)!;
            const isElementLegal = unlockedElementsSet.has(cat.element.toUpperCase());
            const catSubtypes = parseCardSubtypes(cat.subtypes, cat.name);
            const isBypassed = catSubtypes.some((st) => bypassedSubtypesSet.has(st.toUpperCase()));

            if (isElementLegal || isBypassed) {
              candidatePool.push({
                cardSlug: cat.slug,
                cardName: cat.name,
                element: cat.element,
                class: cat.class,
                type: cat.type,
                subtypes: catSubtypes,
                effect: cat.effect || "",
                costReserve: cat.costReserve,
                costMemory: cat.costMemory,
                speed: cat.speed,
                tier: "unowned_upgrade",
                ownedQuantity: 0,
                idleQuantity: 0,
                sharedQuantity: 0,
                storeQuantity: 0,
                classBonusActive:
                  activeChampionClassesSet.size === 0 ||
                  cat.class.toUpperCase() === "ALL" ||
                  cat.class.toUpperCase() === "GENERIC" ||
                  activeChampionClassesSet.has(cat.class.toUpperCase()),
              });
              candidateSlugs.add(cat.slug);
            }
          }
        }
      } catch (e: unknown) {
        console.warn(`[DeckAdvisor] Failed to parse archetype decklist for ${matchingArchetype.name}:`, e);
      }
    }

    metaComparison = {
      archetypeId: matchingArchetype.id,
      archetypeName: matchingArchetype.name,
      tier: matchingArchetype.tier,
      champion: matchingArchetype.champion,
      shareRate: matchingArchetype.shareRate,
      winRate: matchingArchetype.winRate,
      missingStaples,
    };
  }

  return {
    deckId: deck.id,
    deckName: deck.name,
    champion: deck.champion,
    format: deck.format,
    deckCards: deckCardSnapshots,
    candidatePool,
    metaComparison,
    unlockedElements: Array.from(unlockedElementsSet),
    bypassedSubtypes,
    activeChampionClasses: Array.from(activeChampionClassesSet),
  };
}
