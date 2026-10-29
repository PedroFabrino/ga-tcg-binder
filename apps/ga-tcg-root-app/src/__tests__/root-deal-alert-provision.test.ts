import { describe, expect, it, vi } from "vitest";
import { ensureRootRecipientChannel } from "../deal-alert-notifier";
import type { RootCommunityConfig } from "../community-config";
import type { RootDealAlertApi } from "../root-deal-alert-transport";
import type { RootBotApi } from "../root-bot-api";

function createRootApi(preExisting: string[] = []) {
  const channels: string[] = [];
  const messages: string[] = [];
  let nextChannel = 0;

  const api: RootDealAlertApi = {
    everyoneRoleId: "role_everyone",
    botId: "app_bot",
    async createChannel() {
      nextChannel += 1;
      const id = `chan-${nextChannel}`;
      channels.push(id);
      return { id };
    },
    async createChannelGroup() {
      return { id: "grp-1" };
    },
    async grantBotFullControl() {},
    async getMemberName() {
      return "Alice";
    },
    async createMessage(request) {
      messages.push(request.content);
      return { id: `msg-${messages.length}` };
    },
    async getChannel(id) {
      if (!channels.includes(id) && !preExisting.includes(id)) {
        throw new Error(`channel not found: ${id}`);
      }
      return { id };
    },
    async deleteMessage() {},
    async deleteChannel() {},
    async sendNotification() {},
  };

  return { api, channels, messages };
}

function createBotApi(
  existing: { channelId: string; messageIds: string[] } | null = null,
  collector: { collectorId: string; locale?: string } | null = null
) {
  const deliveries: Array<Record<string, unknown>> = [];
  const api = {
    getDealAlertChannel: vi.fn().mockResolvedValue(existing),
    getCollector: vi.fn().mockResolvedValue(collector),
    recordDealAlertDelivery: vi.fn(async (record: Record<string, unknown>) => {
      deliveries.push(record);
    }),
    recordDealAlertCleanup: vi.fn(),
  } as unknown as RootBotApi;
  return { api, deliveries };
}

function createConfig(): RootCommunityConfig {
  let section: string | undefined = "grp-1";
  return {
    async getBroadcastChannelId() {
      return undefined;
    },
    async setBroadcastChannelId() {},
    async getAlertSectionId() {
      return section;
    },
    async setAlertSectionId(id) {
      section = id;
    },
  };
}

describe("ensureRootRecipientChannel", () => {
  it("creates the channel with a welcome message and records delivery", async () => {
    const root = createRootApi();
    const bot = createBotApi(null);

    const channelId = await ensureRootRecipientChannel("root_user_1", {
      communityId: "comm-1",
      api: bot.api,
      config: createConfig(),
      rootApi: root.api,
    });

    expect(channelId).toBe("chan-1");
    expect(root.channels).toEqual(["chan-1"]);
    expect(root.messages[0]).toContain("Deal alerts are on");
    expect(bot.api.recordDealAlertDelivery).toHaveBeenCalledWith({
      recipientId: "root_user_1",
      channelId: "chan-1",
      messageIds: ["msg-1"],
      lastListingKeys: [],
    });
  });

  it("creates the channel with a Portuguese welcome message when locale is pt-BR", async () => {
    const root = createRootApi();
    const bot = createBotApi(null, { collectorId: "root_user_1", locale: "pt-BR" });

    const channelId = await ensureRootRecipientChannel("root_user_1", {
      communityId: "comm-1",
      api: bot.api,
      config: createConfig(),
      rootApi: root.api,
    });

    expect(channelId).toBe("chan-1");
    expect(root.messages[0]).toContain("Alertas de ofertas ativados");
  });

  it("reuses an existing channel without creating another", async () => {
    const root = createRootApi(["chan-existing"]);
    const bot = createBotApi({
      channelId: "chan-existing",
      messageIds: ["msg-old"],
    });

    const channelId = await ensureRootRecipientChannel("root_user_1", {
      communityId: "comm-1",
      api: bot.api,
      config: createConfig(),
      rootApi: root.api,
    });

    expect(channelId).toBe("chan-existing");
    expect(root.channels).toHaveLength(0);
  });

  it("recreates the channel when the stored channel was deleted", async () => {
    const root = createRootApi();
    const bot = createBotApi({
      channelId: "chan-existing",
      messageIds: ["msg-old"],
    });

    const channelId = await ensureRootRecipientChannel("root_user_1", {
      communityId: "comm-1",
      api: bot.api,
      config: createConfig(),
      rootApi: root.api,
    });

    expect(channelId).toBe("chan-1");
    expect(root.channels).toEqual(["chan-1"]);
    expect(root.messages[0]).toContain("Deal alerts are on");
    expect(bot.api.recordDealAlertDelivery).toHaveBeenCalledWith({
      recipientId: "root_user_1",
      channelId: "chan-1",
      messageIds: ["msg-1"],
      lastListingKeys: [],
    });
  });

  it("throws descriptive error when no market group is configured", async () => {
    const root = createRootApi();
    const bot = createBotApi();
    const unconfiguredConfig = {
      getAlertSectionId: vi.fn().mockResolvedValue(undefined),
      setAlertSectionId: vi.fn(),
    } as unknown as RootCommunityConfig;

    await expect(
      ensureRootRecipientChannel("root_user_1", {
        communityId: "comm-1",
        api: bot.api,
        config: unconfiguredConfig,
        rootApi: root.api,
      })
    ).rejects.toThrow(
      "No market group configured — provision market channels in the Assistant App GUI first."
    );
  });
});
