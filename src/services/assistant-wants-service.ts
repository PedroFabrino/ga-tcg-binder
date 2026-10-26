import {
  listPersonalWants,
  upsertPersonalWant,
  removePersonalWant,
  type PersonalWantItem,
  type RemovePersonalWantResult,
} from "../db/repositories/personal-wants-repository";
import {
  findCardBySlugOrName,
  searchCardsForAutocomplete,
} from "../db/repositories/catalog-repository";
import {
  importOmnidexDeckToPersonalWants,
  importOmnidexDeckToCollection,
  type OmnidexWantsImportResult,
} from "./omnidex-wants";
import { fetchDeckFromUrl } from "./omnidex";
import { updateDeckService } from "./deck";
import {
  registerCollectorFromPlatform,
  getCollectorDecks,
  type CollectorProfile,
} from "./collector-assistant";
import type { AssistantProvider } from "@ga/contracts";

export interface RegisterAssistantInput {
  provider: AssistantProvider;
  providerUserId: string;
  providerUsername?: string | null;
}

export interface RegisterAssistantResult {
  collector: CollectorProfile;
  created: boolean;
}

export interface AddPersonalWantInput {
  cardInput?: string;
  quantity?: number;
  foil?: boolean | null;
  omnidexUrl?: string;
  omnidexText?: string;
}

export interface AddPersonalWantResult {
  importedOmnidex?: boolean;
  omnidexStats?: OmnidexWantsImportResult;
  card?: {
    slug: string;
    name: string;
  };
  desiredQuantity?: number;
  foil?: boolean | null;
  suggestions?: Array<{ name: string; slug: string }>;
}

export interface RemovePersonalWantInput {
  cardInput: string;
  quantity?: number;
}

export interface RemovePersonalWantResultExtended extends RemovePersonalWantResult {
  cardName: string;
  suggestions?: Array<{ name: string; slug: string; quantity: number }>;
}

export interface AutocompleteChoiceResult {
  name: string;
  value: string;
  element?: string;
  type?: string;
  quantity?: number;
  foil?: boolean | null;
}

export async function registerAssistantUser(
  input: RegisterAssistantInput,
  database?: unknown
): Promise<RegisterAssistantResult> {
  return registerCollectorFromPlatform(
    {
      provider: input.provider,
      providerUserId: input.providerUserId,
      providerUsername: input.providerUsername,
    },
    database
  );
}

function resolveDeckSource(url?: string, text?: string): { url?: string; text?: string } {
  let deckText = text?.trim();
  let deckUrl = url?.trim();

  if (deckUrl && !deckUrl.startsWith("http://") && !deckUrl.startsWith("https://")) {
    deckText = deckUrl;
    deckUrl = undefined;
  } else if (deckText && (deckText.startsWith("http://") || deckText.startsWith("https://")) && !deckUrl) {
    deckUrl = deckText;
    deckText = undefined;
  }

  return { url: deckUrl, text: deckText };
}

export async function addWantToAssistant(
  collectorId: string,
  input: AddPersonalWantInput,
  database?: unknown
): Promise<AddPersonalWantResult> {
  // Handle Omnidex import (gap shortage)
  if (input.omnidexUrl || input.omnidexText) {
    const src = resolveDeckSource(input.omnidexUrl, input.omnidexText);
    let rawText = src.text || "";
    if (src.url) {
      const fetched = await fetchDeckFromUrl(src.url);
      rawText = fetched.decklist;
    }

    const stats = await importOmnidexDeckToPersonalWants(collectorId, rawText, database);
    return {
      importedOmnidex: true,
      omnidexStats: stats,
    };
  }

  const cardQuery = (input.cardInput || "").trim();
  if (!cardQuery) {
    throw new Error("Missing card name or Omnidex URL");
  }

  // 1. Try exact match by slug or display name
  const exactCard = await findCardBySlugOrName(cardQuery, database as any);
  if (exactCard) {
    const qty = input.quantity && input.quantity > 0 ? input.quantity : 1;
    const foil = input.foil !== undefined ? input.foil : null;

    await upsertPersonalWant(
      {
        collectorId,
        cardSlug: exactCard.slug,
        desiredQuantity: qty,
        foil,
        source: "manual",
      },
      database as any
    );

    return {
      card: { slug: exactCard.slug, name: exactCard.name },
      desiredQuantity: qty,
      foil,
    };
  }

  // 2. Try autocomplete fuzzy search
  const suggestions = await searchCardsForAutocomplete(cardQuery, 10, database as any);
  if (suggestions.length === 1) {
    const single = suggestions[0];
    const qty = input.quantity && input.quantity > 0 ? input.quantity : 1;
    const foil = input.foil !== undefined ? input.foil : null;

    await upsertPersonalWant(
      {
        collectorId,
        cardSlug: single.slug,
        desiredQuantity: qty,
        foil,
        source: "manual",
      },
      database as any
    );

    return {
      card: { slug: single.slug, name: single.name },
      desiredQuantity: qty,
      foil,
    };
  }

  if (suggestions.length > 1) {
    return {
      suggestions: suggestions.map((s) => ({ name: s.name, slug: s.slug })),
    };
  }

  throw new Error(`Card "${cardQuery}" not found in Grand Archive catalog`);
}

export async function removeWantFromAssistant(
  collectorId: string,
  input: RemovePersonalWantInput,
  database?: unknown
): Promise<RemovePersonalWantResultExtended> {
  const query = (input.cardInput || "").trim().toLowerCase();
  const personalWants = await listPersonalWants(collectorId, database as any);

  if (personalWants.length === 0) {
    return {
      success: false,
      removed: false,
      remainingQuantity: 0,
      cardName: input.cardInput,
    };
  }

  // 1. Check exact match
  const exact = personalWants.find(
    (w) => w.cardSlug.toLowerCase() === query || w.cardName.toLowerCase() === query
  );

  if (exact) {
    const res = await removePersonalWant(collectorId, exact.cardSlug, input.quantity, database as any);
    return {
      ...res,
      cardName: exact.cardName,
    };
  }

  // 2. Partial match in user's personal wants
  const matches = personalWants.filter(
    (w) => w.cardSlug.toLowerCase().includes(query) || w.cardName.toLowerCase().includes(query)
  );

  if (matches.length === 1) {
    const single = matches[0];
    const res = await removePersonalWant(collectorId, single.cardSlug, input.quantity, database as any);
    return {
      ...res,
      cardName: single.cardName,
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      removed: false,
      remainingQuantity: 0,
      cardName: input.cardInput,
      suggestions: matches.map((m) => ({
        name: m.cardName,
        slug: m.cardSlug,
        quantity: m.desiredQuantity,
      })),
    };
  }

  return {
    success: false,
    removed: false,
    remainingQuantity: 0,
    cardName: input.cardInput,
  };
}

export async function getAssistantWants(
  collectorId: string,
  database?: unknown
): Promise<PersonalWantItem[]> {
  return listPersonalWants(collectorId, database as any);
}

export async function getAutocompleteChoices(
  collectorId: string | null,
  type: "card" | "wants" | "deck",
  query: string,
  database?: unknown
): Promise<AutocompleteChoiceResult[]> {
  const clean = query.trim().toLowerCase();

  if (type === "card") {
    const cards = await searchCardsForAutocomplete(clean, 15, database as any);
    return cards.map((c) => ({
      name: c.name,
      value: c.slug,
      element: c.element,
      type: c.type,
    }));
  }

  if (!collectorId) {
    return [];
  }

  if (type === "wants") {
    const wants = await listPersonalWants(collectorId, database as any);
    const filtered = clean
      ? wants.filter(
          (w) =>
            w.cardName.toLowerCase().includes(clean) ||
            w.cardSlug.toLowerCase().includes(clean)
        )
      : wants;

    return filtered.slice(0, 15).map((w) => ({
      name: w.cardName,
      value: w.cardSlug,
      element: w.element,
      type: w.type,
      quantity: w.desiredQuantity,
      foil: w.foil,
    }));
  }

  if (type === "deck") {
    const decks = await getCollectorDecks(collectorId, database);
    const filtered = clean
      ? decks.filter(
          (d) =>
            d.name.toLowerCase().includes(clean) ||
            (d.champion && d.champion.toLowerCase().includes(clean))
        )
      : decks;

    return filtered.slice(0, 15).map((d) => ({
      name: d.name,
      value: d.name,
    }));
  }

  return [];
}

export async function importAssistantDeckFromSource(
  collectorId: string,
  input: {
    url?: string;
    text?: string;
    name?: string;
    champion?: string;
    format?: string;
  },
  database?: unknown
): Promise<{ id: string; name: string }> {
  const src = resolveDeckSource(input.url, input.text);
  let deckText = src.text || "";
  let deckName = input.name;

  if (src.url) {
    const fetched = await fetchDeckFromUrl(src.url);
    deckText = fetched.decklist;
    if (!deckName) {
      deckName = fetched.name || "Imported Deck";
    }
  }

  if (!deckText) {
    throw new Error("No decklist content or valid URL provided");
  }

  return importOmnidexDeckToCollection(
    collectorId,
    deckName || "Imported Deck",
    deckText,
    input.champion,
    input.format || "standard",
    database
  );
}

export async function updateAssistantDeckFromSource(
  collectorId: string,
  input: {
    deckId: string;
    url?: string;
    text?: string;
    name?: string;
    champion?: string;
    format?: string;
  },
  database?: unknown
): Promise<{ id: string; name: string }> {
  const src = resolveDeckSource(input.url, input.text);
  let deckText = src.text || "";
  let deckName = input.name;

  if (src.url) {
    const fetched = await fetchDeckFromUrl(src.url);
    deckText = fetched.decklist;
    if (!deckName) {
      deckName = fetched.name || undefined;
    }
  }

  await updateDeckService(
    input.deckId,
    {
      name: deckName,
      champion: input.champion,
      format: input.format,
      ...(deckText ? { omnidexText: deckText } : {}),
    },
    database as any
  );

  return { id: input.deckId, name: deckName || "Updated Deck" };
}
