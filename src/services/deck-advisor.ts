import {
  getDeckAdvisorDeckData,
  getDeckAdvisorUserData,
  getDeckAdvisorMetaBenchmarks,
} from "../db/repositories/deck-advisor-repository";
import {
  assembleDeckAdvisorContext,
  isUserAdvisorAllowlisted,
} from "./deck-advisor-context";
import type {
  DeckAdvisorContextSnapshot,
  DeckAdvisorMessage,
  DeckAdvisorChatResponse,
} from "@ga/contracts";

export interface DeckAdvisorLlmOptions {
  geminiApiKey?: string;
  geminiModel?: string;
  geminiBaseUrl?: string;
  omnirouteUrl?: string;
  omnirouteModel?: string;
  customFetch?: typeof fetch;
}

/**
 * Builds the system prompt grounding the model in the selected Deck & Candidate Pool.
 */
export function buildDeckAdvisorSystemPrompt(context: DeckAdvisorContextSnapshot): string {
  const cardsJson = JSON.stringify(
    context.deckCards.map((c) => ({
      name: c.cardName,
      zone: c.zone,
      qty: c.quantity,
      costMemory: c.costMemory,
      costReserve: c.costReserve,
      speed: c.speed ? "Fast" : "Slow",
      element: c.element,
      class: c.class,
      subtypes: c.subtypes,
      effect: c.effect,
      hardShortage: c.hardShortage,
    })),
    null,
    2
  );

  const candidateJson = JSON.stringify(
    context.candidatePool.map((c) => ({
      name: c.cardName,
      element: c.element,
      class: c.class,
      type: c.type,
      subtypes: c.subtypes,
      costMemory: c.costMemory,
      costReserve: c.costReserve,
      speed: c.speed ? "Fast" : "Slow",
      tier: c.tier,
      idleQty: c.idleQuantity,
      sharedQty: c.sharedQuantity,
      storeQty: c.storeQuantity,
      unlockedVia: c.unlockedViaReason,
      classBonusActive: c.classBonusActive,
      effect: c.effect,
    })),
    null,
    2
  );

  return [
    "You are the expert Grand Archive TCG Deck Advisor and referee.",
    "Rules and card effects are absolute. Never hallucinate card text, costs, or inventory quantities.",
    `Selected Deck: "${context.deckName}" (Champion: ${context.champion || "Unknown"}, Format: ${context.format}).`,
    `Unlocked Elements: ${context.unlockedElements.join(", ")}.`,
    context.bypassedSubtypes.length > 0
      ? `Effect-Driven Legality Bypasses: ${context.bypassedSubtypes.map((b) => `${b.subtype} (via ${b.unlockedByCard})`).join(", ")}.`
      : "No subtype legality bypasses present.",
    `Active Champion Classes: ${context.activeChampionClasses.join(", ") || "None"}. Note: Off-class cards are legal for base effects if elemental requirements are met, but do not activate [Class Bonus].`,
    "",
    "--- CURRENT DECKLIST ---",
    cardsJson,
    "",
    "--- CANDIDATE POOL (OWNED CARDS AVAILABLE TO SWAP) ---",
    candidateJson,
    "",
    context.metaComparison
      ? `--- META BENCHMARK (${context.metaComparison.archetypeName} - ${context.metaComparison.tier}) ---\nWin Rate: ${context.metaComparison.winRate}, Share Rate: ${context.metaComparison.shareRate}.\nMissing Staples: ${JSON.stringify(context.metaComparison.missingStaples)}`
      : "",
    "",
    "Instructions:",
    "1. When recommending swaps, clearly cite the card acquisition tier: Tier 1 (Binder Available: Idle or Shared), Tier 2 (Store Listing Pull-Back), or Tier 3 (Unowned upgrade creating a Hard Shortage).",
    "2. Be concise, strategic, and accurate regarding Memory vs. Reserve costs, Lineage, and Timing (Slow vs. Fast).",
  ].join("\n");
}

/**
 * Executes a turn of Deck Advisor chat, with automatic OmniRoute fallback on HTTP 429.
 */
export async function runDeckAdvisorChat(
  userId: string,
  userEmail: string | null | undefined,
  deckId: string,
  messages: DeckAdvisorMessage[],
  database?: any,
  options: DeckAdvisorLlmOptions = {}
): Promise<DeckAdvisorChatResponse> {
  const customFetch = options.customFetch || fetch;

  // 1. Gating
  if (!isUserAdvisorAllowlisted({ id: userId, email: userEmail })) {
    throw new Error("UNAUTHORIZED_ADVISOR_ACCESS");
  }

  // 2. Fetch data
  const [deckData, userData, metaBenchmarks] = await Promise.all([
    getDeckAdvisorDeckData(deckId, database),
    getDeckAdvisorUserData(userId, database),
    getDeckAdvisorMetaBenchmarks(database),
  ]);

  if (!deckData) {
    throw new Error(`DECK_NOT_FOUND: ${deckId}`);
  }

  const context = assembleDeckAdvisorContext({
    deckData,
    userData,
    metaBenchmarks,
  });

  const systemPrompt = buildDeckAdvisorSystemPrompt(context);
  const conversation = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || "";
  const geminiModel = options.geminiModel || process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const geminiBaseUrl =
    options.geminiBaseUrl ||
    process.env.GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta/openai";

  const omnirouteUrl = options.omnirouteUrl || process.env.OMNIROUTE_URL || "http://localhost:20128/v1";
  const omnirouteModel = options.omnirouteModel || "combo/auto-fallback";

  // Try Primary (Gemini)
  let fallbackActivated = false;
  let providerUsed: "gemini" | "omniroute" = "gemini";
  let modelUsed = geminiModel;

  if (geminiApiKey) {
    try {
      const res = await customFetch(`${geminiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${geminiApiKey}`,
        },
        body: JSON.stringify({
          model: geminiModel,
          messages: conversation,
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const reply = json.choices?.[0]?.message?.content || "";
        return {
          message: { role: "assistant", content: reply },
          fallbackActivated: false,
          providerUsed: "gemini",
          modelUsed: geminiModel,
        };
      }

      if (res.status === 429) {
        console.warn("[DeckAdvisor] Gemini API HTTP 429 encountered. Activating OmniRoute fallback.");
        fallbackActivated = true;
      } else {
        const errText = await res.text();
        console.warn(`[DeckAdvisor] Gemini API failed with status ${res.status}: ${errText}. Falling back.`);
        fallbackActivated = true;
      }
    } catch (e: any) {
      console.warn(`[DeckAdvisor] Gemini request error: ${e.message}. Activating OmniRoute fallback.`);
      fallbackActivated = true;
    }
  } else {
    fallbackActivated = true;
  }

  // Fallback to OmniRoute
  providerUsed = "omniroute";
  modelUsed = omnirouteModel;

  const omniRes = await customFetch(`${omnirouteUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: omnirouteModel,
      messages: conversation,
      temperature: 0.2,
    }),
  });

  if (!omniRes.ok) {
    throw new Error(`Failed to generate advice: OmniRoute responded with status ${omniRes.status}`);
  }

  const omniJson = await omniRes.json();
  const reply = omniJson.choices?.[0]?.message?.content || "";

  return {
    message: { role: "assistant", content: reply },
    fallbackActivated: true,
    providerUsed: "omniroute",
    modelUsed: omnirouteModel,
  };
}
