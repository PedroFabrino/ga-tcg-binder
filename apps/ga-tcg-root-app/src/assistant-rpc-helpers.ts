import type {
  DeckSummary,
  AutocompleteChoiceItem,
  PersonalWantRpcItem,
} from "@ga/gen-shared";
import type { RootBotApi } from "./root-bot-api";
import {
  ensureRootRecipientChannel,
  removeRootDealAlertChannel,
} from "./deal-alert-notifier";

export async function buildDeckSummariesWithShortages(
  api: RootBotApi,
  userId: string,
  rawDecks: Array<{
    id: string;
    name: string;
    champion?: string | null;
    format: string;
    totalCards: number;
    hardShortageCount: number;
    sharedShortageCount: number;
    decklistText?: string;
  }>
): Promise<DeckSummary[]> {
  return Promise.all(
    rawDecks.map(async (deck) => {
      let hardShortages: Array<{
        cardSlug: string;
        cardName: string;
        quantity: number;
      }> = [];
      let sharedShortages: Array<{
        cardSlug: string;
        cardName: string;
        quantity: number;
      }> = [];

      try {
        const shortages = await api.getShortages(userId, deck.id);
        hardShortages = (shortages.hardShortages || []).map((h) => ({
          cardSlug: h.cardSlug || "",
          cardName: h.cardName,
          quantity: h.missingQuantity,
        }));
        sharedShortages = (shortages.sharedShortages || []).map((s) => ({
          cardSlug: s.cardSlug || "",
          cardName: s.cardName,
          quantity: s.sharedQuantity,
        }));
      } catch {
        // Degrades gracefully on missing shortages
      }

      return {
        id: deck.id,
        name: deck.name,
        champion: deck.champion || "",
        format: deck.format,
        totalCards: deck.totalCards,
        hardShortagesCount: deck.hardShortageCount,
        sharedShortagesCount: deck.sharedShortageCount,
        hardShortages,
        sharedShortages,
        omnidexText: deck.decklistText || "",
      };
    })
  );
}

export async function updateDealAlertPreferencesHelper(
  api: RootBotApi,
  userId: string,
  communityId: string,
  notificationsEnabled: boolean,
  mode: "all" | "hard",
  overrides?: {
    setNotificationPreference?: (
      userId: string,
      enabled: boolean,
      mode?: "all" | "hard"
    ) => Promise<void>;
    ensureRecipientChannel?: (
      userId: string,
      communityId?: string
    ) => Promise<string | null>;
    removeDealAlertChannel?: (
      userId: string,
      communityId?: string
    ) => Promise<void>;
  }
): Promise<{ alertChannelId: string }> {
  if (overrides?.setNotificationPreference) {
    await overrides.setNotificationPreference(userId, notificationsEnabled, mode);
  } else {
    await api.setNotifyPreference({
      providerUserId: userId,
      enabled: notificationsEnabled,
      mode,
    });
  }

  let alertChannelId = "";
  if (notificationsEnabled) {
    const channelUrl = overrides?.ensureRecipientChannel
      ? await overrides.ensureRecipientChannel(userId, communityId)
      : await ensureRootRecipientChannel(userId, { communityId, api });
    alertChannelId = channelUrl ? channelUrl.replace(/^root:\/\/channel\//, "") : "";
  } else {
    if (overrides?.removeDealAlertChannel) {
      await overrides.removeDealAlertChannel(userId, communityId);
    } else {
      await removeRootDealAlertChannel(userId, { communityId, api });
    }
  }

  return { alertChannelId };
}

export function mapAutocompleteChoice(r: {
  name: string;
  value: string;
  element?: string | null;
  type?: string | null;
  quantity?: number;
  foil?: boolean | number | null;
}): AutocompleteChoiceItem {
  return {
    name: r.name,
    value: r.value,
    element: r.element || "",
    type: r.type || "",
    quantity: r.quantity || 0,
    foil: Boolean(r.foil),
  };
}

export function mapPersonalWant(w: {
  cardSlug: string;
  cardName: string;
  element?: string | null;
  type?: string | null;
  desiredQuantity: number;
  foil?: boolean | number | null;
}): PersonalWantRpcItem {
  return {
    cardSlug: w.cardSlug,
    cardName: w.cardName,
    element: w.element || "",
    type: w.type || "",
    desiredQuantity: w.desiredQuantity,
    foil: Boolean(w.foil),
  };
}
