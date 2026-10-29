export type DeckZone = "material" | "main" | "side";

export interface DeckAdvisorSwapCut {
  cardName: string;
  zone: DeckZone;
  quantity: number;
}

export interface DeckAdvisorSwapAdd {
  cardName: string;
  zone: DeckZone;
  quantity: number;
  tier: "binder_available" | "store_pullback" | "unowned_upgrade";
}

export interface DeckAdvisorSwapProposal {
  id: string;
  title: string;
  rationale: string;
  cuts: DeckAdvisorSwapCut[];
  adds: DeckAdvisorSwapAdd[];
  updatedOmnidexText?: string;
  netImpact?: "immediate" | "store_pullback" | "hard_shortage";
}

export interface DeckAdvisorMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolsUsed?: string[];
  swapProposals?: DeckAdvisorSwapProposal[];
}

export interface DeckAdvisorCandidateCard {
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  subtypes: string[];
  effect: string;
  costReserve: number | null;
  costMemory: number | null;
  speed: boolean | null;
  tier: "binder_available" | "store_pullback" | "unowned_upgrade";
  ownedQuantity: number;
  idleQuantity: number;
  sharedQuantity: number;
  storeQuantity: number;
  isDedicatedToOtherDeck?: boolean;
  unlockedViaReason?: string;
  classBonusActive: boolean;
}

export interface DeckAdvisorDeckCardSnapshot {
  id: string;
  cardSlug: string;
  cardName: string;
  zone: DeckZone;
  quantity: number;
  element: string;
  class: string;
  type: string;
  subtypes: string[];
  effect: string;
  costReserve: number | null;
  costMemory: number | null;
  speed: boolean | null;
  hardShortage: number;
  sharedShortage: number;
}

export interface DeckAdvisorMetaComparison {
  archetypeId: string;
  archetypeName: string;
  tier: string;
  champion: string;
  shareRate: string;
  winRate: string;
  missingStaples: {
    cardSlug: string;
    cardName: string;
    recommendedCopies: number;
    ownedCopies: number;
    deficit: number;
  }[];
}

export interface DeckAdvisorContextSnapshot {
  deckId: string;
  deckName: string;
  champion: string | null;
  format: string;
  deckCards: DeckAdvisorDeckCardSnapshot[];
  candidatePool: DeckAdvisorCandidateCard[];
  metaComparison: DeckAdvisorMetaComparison | null;
  unlockedElements: string[];
  bypassedSubtypes: { subtype: string; unlockedByCard: string }[];
  activeChampionClasses: string[];
}

export interface DeckAdvisorChatRequest {
  deckId: string;
  messages: DeckAdvisorMessage[];
}

export interface DeckAdvisorChatResponse {
  message: DeckAdvisorMessage;
  fallbackActivated: boolean;
  providerUsed: "gemini" | "omniroute";
  modelUsed: string;
  toolsConsulted?: string[];
}

export interface DeckAdvisorAvailabilityResponse {
  enabled: boolean;
  allowed: boolean;
}
