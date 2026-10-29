import type {
  DeckAdvisorCandidateCard,
  DeckAdvisorDeckCardSnapshot,
  DeckAdvisorMetaComparison,
  DeckAdvisorContextSnapshot,
} from "@ga/contracts";
import type {
  DeckAdvisorRawDeckData,
  DeckAdvisorRawUserData,
} from "../db/repositories/deck-advisor-repository";

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
  };
}): DeckAdvisorContextSnapshot {
  const { deck, deckCards } = params.deckData;
  const { inventory, storeListings, otherDeckCardUsages } = params.userData;

  // 1. Unlocked Elements from Deck
  const unlockedElementsSet = new Set<string>(["NORM"]);
  const activeChampionClassesSet = new Set<string>();

  for (const c of deckCards) {
    if (c.element) unlockedElementsSet.add(c.element.toUpperCase());
    if (c.zone === "material" && c.type?.toUpperCase() === "CHAMPION" && c.class) {
      activeChampionClassesSet.add(c.class.toUpperCase());
    }
  }

  // 2. Subtype Bypasses
  const bypassedSubtypes = detectSubtypeLegalityBypasses(deckCards);
  const bypassedSubtypesSet = new Set(bypassedSubtypes.map((b) => b.subtype.toUpperCase()));

  // 3. User Dedicated & Usage mapping
  const dedicatedToOtherDecks = new Set<string>();
  for (const inv of inventory) {
    if (inv.isDedicated) {
      // Check if used in other deck
      const usedInOther = otherDeckCardUsages.some(
        (u) => u.cardSlug === inv.cardSlug && u.deckId !== deck.id
      );
      if (usedInOther) dedicatedToOtherDecks.add(inv.cardSlug);
    }
  }

  // 4. Inventory aggregation by slug
  const inventoryBySlug = new Map<
    string,
    {
      cardSlug: string;
      name: string;
      element: string;
      class: string;
      type: string;
      subtypes: string[];
      effect: string;
      costReserve: number | null;
      costMemory: number | null;
      speed: boolean | null;
      ownedQuantity: number;
      idleQuantity: number;
      sharedQuantity: number;
    }
  >();

  for (const inv of inventory) {
    let entry = inventoryBySlug.get(inv.cardSlug);
    if (!entry) {
      let parsedSubtypes: string[] = [];
      try {
        parsedSubtypes = JSON.parse(inv.subtypes);
      } catch {
        parsedSubtypes = [];
      }
      entry = {
        cardSlug: inv.cardSlug,
        name: inv.name,
        element: inv.element,
        class: inv.class,
        type: inv.type,
        subtypes: parsedSubtypes,
        effect: inv.effect || "",
        costReserve: inv.costReserve,
        costMemory: inv.costMemory,
        speed: inv.speed,
        ownedQuantity: 0,
        idleQuantity: 0,
        sharedQuantity: 0,
      };
      inventoryBySlug.set(inv.cardSlug, entry);
    }
    entry.ownedQuantity += inv.quantity;
    if (inv.isDedicated) {
      // Dedicated copy
    } else {
      entry.sharedQuantity += inv.quantity;
      const otherDemand = otherDeckCardUsages
        .filter((u) => u.cardSlug === inv.cardSlug && u.deckId !== deck.id)
        .reduce((sum, u) => sum + u.quantity, 0);
      entry.idleQuantity = Math.max(0, entry.ownedQuantity - otherDemand);
    }
  }

  // Store listings by slug
  const storeBySlug = new Map<string, number>();
  for (const s of storeListings) {
    if (s.cardSlug) {
      storeBySlug.set(s.cardSlug, (storeBySlug.get(s.cardSlug) || 0) + s.quantity);
    }
  }

  // 5. Deck Card Snapshots
  const deckCardSnapshots: DeckAdvisorDeckCardSnapshot[] = deckCards.map((c) => {
    let parsedSubtypes: string[] = [];
    try {
      parsedSubtypes = JSON.parse(c.subtypes || "[]");
    } catch {
      parsedSubtypes = [];
    }

    const owned = inventoryBySlug.get(c.cardSlug)?.ownedQuantity || 0;
    const missing = Math.max(0, c.quantity - owned);

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
      hardShortage: missing,
      sharedShortage: 0,
    };
  });

  // 6. Build Candidate Pool
  const candidatePool: DeckAdvisorCandidateCard[] = [];

  for (const inv of Array.from(inventoryBySlug.values())) {
    const isElementLegal = unlockedElementsSet.has(inv.element.toUpperCase());
    const isBypassed = inv.subtypes.some((st) => bypassedSubtypesSet.has(st.toUpperCase()));

    if (!isElementLegal && !isBypassed) {
      continue;
    }

    const isClassMatching =
      activeChampionClassesSet.size === 0 ||
      inv.class.toUpperCase() === "ALL" ||
      inv.class.toUpperCase() === "GENERIC" ||
      activeChampionClassesSet.has(inv.class.toUpperCase());

    let unlockReason: string | undefined = undefined;
    if (!isElementLegal && isBypassed) {
      const match = bypassedSubtypes.find((b) =>
        inv.subtypes.some((st) => st.toUpperCase() === b.subtype.toUpperCase())
      );
      if (match) {
        unlockReason = match.unlockedByCard;
      }
    }

    const isDedicatedToOther = dedicatedToOtherDecks.has(inv.cardSlug);
    const storeQty = storeBySlug.get(inv.cardSlug) || 0;

    let tier: "binder_available" | "store_pullback" | "unowned_upgrade" = "binder_available";
    if (inv.ownedQuantity === 0 && storeQty > 0) {
      tier = "store_pullback";
    }

    candidatePool.push({
      cardSlug: inv.cardSlug,
      cardName: inv.name,
      element: inv.element,
      class: inv.class,
      type: inv.type,
      subtypes: inv.subtypes,
      effect: inv.effect,
      costReserve: inv.costReserve,
      costMemory: inv.costMemory,
      speed: inv.speed,
      tier,
      ownedQuantity: inv.ownedQuantity,
      idleQuantity: inv.idleQuantity,
      sharedQuantity: inv.sharedQuantity,
      storeQuantity: storeQty,
      isDedicatedToOtherDeck: isDedicatedToOther,
      unlockedViaReason: unlockReason,
      classBonusActive: isClassMatching,
    });
  }

  // 7. Meta Benchmarking
  let metaComparison: DeckAdvisorMetaComparison | null = null;
  const deckChampion = deck.champion || "";

  const matchingArchetype = params.metaBenchmarks.archetypes.find((a) => {
    if (deckChampion && a.champion.toLowerCase().includes(deckChampion.toLowerCase())) {
      return true;
    }
    return false;
  }) || params.metaBenchmarks.archetypes[0];

  if (matchingArchetype) {
    const missingStaples: DeckAdvisorMetaComparison["missingStaples"] = [];
    for (const staple of params.metaBenchmarks.staples) {
      const owned = inventoryBySlug.get(staple.cardSlug)?.ownedQuantity || 0;
      if (owned < staple.recommendedCopies) {
        missingStaples.push({
          cardSlug: staple.cardSlug,
          cardName: staple.cardName,
          recommendedCopies: staple.recommendedCopies,
          ownedCopies: owned,
          deficit: staple.recommendedCopies - owned,
        });
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
