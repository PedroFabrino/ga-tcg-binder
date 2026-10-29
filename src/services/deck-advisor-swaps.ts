import { serializeOmnidexText } from "./omnidex";
import type {
  DeckAdvisorSwapProposal,
  DeckAdvisorSwapCut,
  DeckAdvisorSwapAdd,
  DeckAdvisorDeckCardSnapshot,
  DeckAdvisorCandidateCard,
  DeckZone,
  DeckAdvisorAcquisitionTier,
} from "@ga/contracts";

interface RawSwapCut {
  cardName?: unknown;
  name?: unknown;
  zone?: unknown;
  quantity?: unknown;
}

interface RawSwapAdd {
  cardName?: unknown;
  name?: unknown;
  zone?: unknown;
  quantity?: unknown;
  tier?: unknown;
}

interface RawSwapProposal {
  id?: unknown;
  title?: unknown;
  rationale?: unknown;
  cuts?: unknown;
  adds?: unknown;
}

/**
 * Calculates net shortage impact based on the acquisition tiers of added cards.
 */
export function computeNetShortageImpact(
  adds: DeckAdvisorSwapAdd[]
): "immediate" | "store_pullback" | "hard_shortage" {
  if (adds.some((a) => a.tier === "unowned_upgrade")) {
    return "hard_shortage";
  }
  if (adds.some((a) => a.tier === "store_pullback")) {
    return "store_pullback";
  }
  return "immediate";
}

/**
 * Normalizes a raw string to a valid DeckZone ("material" | "main" | "side").
 */
export function normalizeDeckZone(rawZone?: string): DeckZone {
  const z = (rawZone || "").trim().toLowerCase();
  if (z.includes("mat")) return "material";
  if (z.includes("side")) return "side";
  return "main";
}

/**
 * Applies proposed cuts and adds to current deck snapshot, returning updated Omnidex Format decklist.
 */
export function applySwapToOmnidex(
  currentDeckCards: DeckAdvisorDeckCardSnapshot[],
  swap: { cuts: DeckAdvisorSwapCut[]; adds: DeckAdvisorSwapAdd[] }
): string {
  const zoneCards: Record<DeckZone, Map<string, { name: string; quantity: number }>> = {
    material: new Map(),
    main: new Map(),
    side: new Map(),
  };

  // Seed from current deck cards
  for (const card of currentDeckCards) {
    const zone = normalizeDeckZone(card.zone);
    const key = (card.cardName || card.cardSlug).toLowerCase();
    const existing = zoneCards[zone].get(key);
    if (existing) {
      existing.quantity += card.quantity;
    } else {
      zoneCards[zone].set(key, {
        name: card.cardName || card.cardSlug,
        quantity: card.quantity,
      });
    }
  }

  // Apply cuts
  for (const cut of swap.cuts || []) {
    const zone = normalizeDeckZone(cut.zone);
    const key = cut.cardName.trim().toLowerCase();
    const existing = zoneCards[zone].get(key);
    if (existing) {
      const remaining = existing.quantity - (cut.quantity || 1);
      if (remaining <= 0) {
        zoneCards[zone].delete(key);
      } else {
        existing.quantity = remaining;
      }
    }
  }

  // Apply adds
  for (const add of swap.adds || []) {
    const zone = normalizeDeckZone(add.zone);
    const key = add.cardName.trim().toLowerCase();
    const existing = zoneCards[zone].get(key);
    if (existing) {
      existing.quantity += add.quantity || 1;
    } else {
      zoneCards[zone].set(key, {
        name: add.cardName.trim(),
        quantity: add.quantity || 1,
      });
    }
  }

  return serializeOmnidexText({
    material: Array.from(zoneCards.material.values()),
    main: Array.from(zoneCards.main.values()),
    side: Array.from(zoneCards.side.values()),
  });
}

/**
 * Infers acquisition tier for a given card name from the Candidate Pool.
 */
function inferTierFromCandidatePool(
  cardName: string,
  candidatePool?: DeckAdvisorCandidateCard[]
): DeckAdvisorAcquisitionTier {
  if (!candidatePool || candidatePool.length === 0) {
    return "binder_available";
  }
  const match = candidatePool.find(
    (c) => c.cardName.toLowerCase() === cardName.trim().toLowerCase()
  );
  if (!match) {
    return "unowned_upgrade";
  }
  return match.tier;
}

/**
 * Extracts and parses structured swap proposals from LLM reply.
 * Strips the JSON block from cleanReply for clean markdown presentation in UI.
 */
export function parseSwapProposalsFromLlm(
  llmReply: string,
  currentDeckCards: DeckAdvisorDeckCardSnapshot[],
  candidatePool?: DeckAdvisorCandidateCard[]
): { cleanReply: string; proposals: DeckAdvisorSwapProposal[] } {
  const proposals: DeckAdvisorSwapProposal[] = [];
  let cleanReply = llmReply;

  // Match ```json:swap ... ``` or ```json ... ``` blocks
  const codeBlockRegex = /```(?:json:swap|json)?\s*([\s\S]*?)\s*```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(llmReply)) !== null) {
    const blockContent = match[1].trim();
    if (!blockContent.startsWith("{") && !blockContent.startsWith("[")) {
      continue;
    }

    try {
      const parsed = JSON.parse(blockContent);
      const rawList: RawSwapProposal[] = Array.isArray(parsed)
        ? (parsed as RawSwapProposal[])
        : Array.isArray((parsed as { swaps?: unknown }).swaps)
        ? ((parsed as { swaps: unknown[] }).swaps as RawSwapProposal[])
        : (parsed as RawSwapProposal).cuts || (parsed as RawSwapProposal).adds
        ? [parsed as RawSwapProposal]
        : [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (!item || (!item.cuts && !item.adds)) continue;

        const cuts: DeckAdvisorSwapCut[] = Array.isArray(item.cuts)
          ? (item.cuts as RawSwapCut[]).map((c) => ({
              cardName: String(c.cardName || c.name || "Unknown"),
              zone: normalizeDeckZone(typeof c.zone === "string" ? c.zone : undefined),
              quantity: Math.max(1, Number(c.quantity) || 1),
            }))
          : [];

        const adds: DeckAdvisorSwapAdd[] = Array.isArray(item.adds)
          ? (item.adds as RawSwapAdd[]).map((a) => {
              const cardName = String(a.cardName || a.name || "Unknown");
              const validTiers: DeckAdvisorAcquisitionTier[] = [
                "binder_available",
                "store_pullback",
                "unowned_upgrade",
              ];
              const rawTier = typeof a.tier === "string" ? a.tier : "";
              const tier = validTiers.includes(rawTier as DeckAdvisorAcquisitionTier)
                ? (rawTier as DeckAdvisorAcquisitionTier)
                : inferTierFromCandidatePool(cardName, candidatePool);

              return {
                cardName,
                zone: normalizeDeckZone(typeof a.zone === "string" ? a.zone : undefined),
                quantity: Math.max(1, Number(a.quantity) || 1),
                tier,
              };
            })
          : [];

        const proposalId = typeof item.id === "string" ? item.id : `swap-${Date.now()}-${i + 1}`;
        const title = typeof item.title === "string" ? item.title : `Swap Proposal #${i + 1}`;
        const rationale = typeof item.rationale === "string" ? item.rationale : "";
        const netImpact = computeNetShortageImpact(adds);
        const updatedOmnidexText = applySwapToOmnidex(currentDeckCards, { cuts, adds });

        proposals.push({
          id: proposalId,
          title,
          rationale,
          cuts,
          adds,
          netImpact,
          updatedOmnidexText,
        });
      }

      // If valid proposals were extracted from this code block, remove it from cleanReply
      if (rawList.length > 0) {
        cleanReply = cleanReply.replace(match[0], "").trim();
      }
    } catch {
      // Ignore JSON parse errors in non-swap code blocks
    }
  }

  return { cleanReply, proposals };
}
