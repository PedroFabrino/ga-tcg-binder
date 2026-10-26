import { AssistantServiceBase } from "@ga/gen-server";
import { type Client } from "@rootsdk/server-app";
import {
  type DecksResponse,
  type LinkRequest,
  type LinkResponse,
  type PreferencesRequest,
  type PreferencesResponse,
  type StatusResponse,
} from "@ga/gen-shared";
import { RootBotApi, RootBotApiError } from "./root-bot-api";
import {
  ensureRootRecipientChannel,
  removeRootDealAlertChannel,
} from "./deal-alert-notifier";

export interface AssistantRpcServiceDeps {
  api?: RootBotApi;
  ensureRecipientChannel?: (
    recipientId: string,
    communityId?: string
  ) => Promise<string | null>;
  removeDealAlertChannel?: (
    recipientId: string,
    communityId?: string
  ) => Promise<void>;
  setNotificationPreference?: (
    providerUserId: string,
    enabled: boolean,
    mode?: "all" | "hard"
  ) => Promise<void>;
}

export class AssistantRpcService extends AssistantServiceBase {
  private readonly api: RootBotApi;

  constructor(
    private readonly communityId?: string,
    private readonly deps: AssistantRpcServiceDeps = {}
  ) {
    super();
    this.api =
      deps.api ??
      new RootBotApi({
        communityId: communityId ?? process.env.COMMUNITY_ID ?? "",
      });
  }

  async getStatus(client: Client): Promise<StatusResponse> {
    const userId = String(client.userId);
    try {
      const [collector, channel] = await Promise.all([
        this.api.getCollector(userId),
        this.api.getDealAlertChannel(userId).catch(() => null),
      ]);

      if (!collector) {
        return {
          isLinked: false,
          collectorId: "",
          collectorName: "",
          friendCode: "",
          notificationsEnabled: false,
          dealAlertMode: "all",
          alertChannelId: "",
        };
      }

      return {
        isLinked: true,
        collectorId: collector.collectorId,
        collectorName: collector.collectorName ?? "",
        friendCode: collector.friendCode ?? "",
        notificationsEnabled: Boolean(collector.notificationsEnabled),
        dealAlertMode: collector.dealAlertMode ?? "all",
        alertChannelId: channel?.channelId ?? "",
      };
    } catch {
      return {
        isLinked: false,
        collectorId: "",
        collectorName: "",
        friendCode: "",
        notificationsEnabled: false,
        dealAlertMode: "all",
        alertChannelId: "",
      };
    }
  }

  async linkAccount(
    request: LinkRequest,
    client: Client
  ): Promise<LinkResponse> {
    const userId = String(client.userId);
    const code = (request.code || "").trim().toUpperCase();

    if (!code) {
      return {
        success: false,
        collectorName: "",
        error: "INVALID_CODE",
      };
    }

    try {
      const res = await this.api.link({
        token: code,
        provider: "root",
        providerUserId: userId,
      });

      return {
        success: true,
        collectorName: res.collectorName ?? "",
        error: "",
      };
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

  async setPreferences(
    request: PreferencesRequest,
    client: Client
  ): Promise<PreferencesResponse> {
    const userId = String(client.userId);
    const communityId = client.communityId
      ? String(client.communityId)
      : this.communityId;
    const mode = request.dealAlertMode === "hard" ? "hard" : "all";

    try {
      if (this.deps.setNotificationPreference) {
        await this.deps.setNotificationPreference(
          userId,
          request.notificationsEnabled,
          mode
        );
      } else {
        await this.api.setNotifyPreference({
          providerUserId: userId,
          enabled: request.notificationsEnabled,
          mode,
        });
      }

      let alertChannelId = "";
      if (request.notificationsEnabled) {
        const channelUrl = this.deps.ensureRecipientChannel
          ? await this.deps.ensureRecipientChannel(userId, communityId)
          : await ensureRootRecipientChannel(userId, {
              communityId,
              api: this.api,
            });
        alertChannelId = channelUrl
          ? channelUrl.replace(/^root:\/\/channel\//, "")
          : "";
      } else {
        if (this.deps.removeDealAlertChannel) {
          await this.deps.removeDealAlertChannel(userId, communityId);
        } else {
          await removeRootDealAlertChannel(userId, {
            communityId,
            api: this.api,
          });
        }
      }

      return {
        success: true,
        notificationsEnabled: request.notificationsEnabled,
        dealAlertMode: mode,
        alertChannelId,
        error: "",
      };
    } catch (err: unknown) {
      return {
        success: false,
        notificationsEnabled: false,
        dealAlertMode: "all",
        alertChannelId: "",
        error: err instanceof Error ? err.message : "SET_PREFERENCES_FAILED",
      };
    }
  }

  async getDecks(client: Client): Promise<DecksResponse> {
    const userId = String(client.userId);
    try {
      const res = await this.api.getDecks(userId);
      const decks = await Promise.all(
        (res.decks || []).map(async (deck) => {
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
            const shortages = await this.api.getShortages(userId, deck.id);
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
            // Shortages breakdown degrades gracefully
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
          };
        })
      );

      return { decks };
    } catch {
      return { decks: [] };
    }
  }
}
