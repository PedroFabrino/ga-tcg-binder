import type {
  DeckSummary,
  AutocompleteChoiceItem,
  PersonalWantRpcItem,
  StatusResponse,
  LinkResponse,
  RegisterResponse,
} from "@ga/gen-shared";
import { RootBotApi, RootBotApiError } from "./root-bot-api";
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
      } catch (err) {
        console.warn(`[assistant-rpc] Failed to load shortages for deck ${deck.id}:`, err);
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
      mode?: "all" | "hard",
      locale?: string
    ) => Promise<void>;
    ensureRecipientChannel?: (
      userId: string,
      communityId?: string,
      locale?: string
    ) => Promise<string | null>;
    removeDealAlertChannel?: (
      userId: string,
      communityId?: string
    ) => Promise<void>;
  },
  locale?: string
): Promise<{ alertChannelId: string }> {
  if (overrides?.setNotificationPreference) {
    if (locale !== undefined) {
      await overrides.setNotificationPreference(
        userId,
        notificationsEnabled,
        mode,
        locale
      );
    } else {
      await overrides.setNotificationPreference(
        userId,
        notificationsEnabled,
        mode
      );
    }
  } else {
    await api.setNotifyPreference({
      providerUserId: userId,
      enabled: notificationsEnabled,
      mode,
      locale,
    });
  }

  let alertChannelId = "";
  if (notificationsEnabled) {
    const channelUrl = overrides?.ensureRecipientChannel
      ? (locale !== undefined
          ? await overrides.ensureRecipientChannel(userId, communityId, locale)
          : await overrides.ensureRecipientChannel(userId, communityId))
      : await ensureRootRecipientChannel(userId, { communityId, api, locale });
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

export function createUnlinkedStatus(isAdmin = false, locale = ""): StatusResponse {
  return {
    isLinked: false,
    collectorId: "",
    collectorName: "",
    friendCode: "",
    notificationsEnabled: false,
    dealAlertMode: "all",
    alertChannelId: "",
    isAdmin,
    locale,
  };
}

export function mapSuggestion(s: {
  name: string;
  slug: string;
  quantity?: number;
}): AutocompleteChoiceItem {
  return {
    name: s.name,
    value: s.slug,
    element: "",
    type: "",
    quantity: s.quantity ?? 0,
    foil: false,
  };
}

export async function linkAccountHelper(
  api: RootBotApi,
  userId: string,
  rawCode?: string
): Promise<LinkResponse> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) {
    return { success: false, collectorName: "", error: "INVALID_CODE" };
  }
  try {
    const res = await api.link({
      token: code,
      provider: "root",
      providerUserId: userId,
    });
    return { success: true, collectorName: res.collectorName ?? "", error: "" };
  } catch (err: unknown) {
    if (err instanceof RootBotApiError) {
      return {
        success: false,
        collectorName: "",
        error: err.code || err.message,
      };
    }
    return {
      success: false,
      collectorName: "",
      error: err instanceof Error ? err.message : "LINK_FAILED",
    };
  }
}

export async function registerAccountHelper(
  api: RootBotApi,
  userId: string
): Promise<RegisterResponse> {
  try {
    const res = await api.register(userId);
    return {
      success: true,
      collectorName: res.collector.name ?? "",
      friendCode: res.collector.friendCode ?? "",
      error: "",
    };
  } catch (err: unknown) {
    return {
      success: false,
      collectorName: "",
      friendCode: "",
      error: err instanceof Error ? err.message : "REGISTER_FAILED",
    };
  }
}

