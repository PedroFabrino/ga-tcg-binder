import { describe, expect, it, vi } from "vitest";
import { ensureRootRecipientChannel } from "../deal-alert-notifier";
import type { RootCommunityConfig } from "../community-config";
import type { RootDealAlertApi } from "../root-deal-alert-transport";
import type { RootBotApi } from "../root-bot-api";

function createRootApi() {
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
    async deleteMessage() {},
    async deleteChannel() {},
    async sendNotification() {},
  };

  return { api, channels, messages };
}

function createBotApi(
  existing: { channelId: string; messageIds: string[] } | null = null
) {
  const deliveries: Array<Record<string, unknown>> = [];
  const api = {
    getDealAlertChannel: vi.fn().mockResolvedValue(existing),
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

  it("reuses an existing channel without creating another", async () => {
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

    expect(channelId).toBe("chan-existing");
    expect(root.channels).toHaveLength(0);
  });
});
