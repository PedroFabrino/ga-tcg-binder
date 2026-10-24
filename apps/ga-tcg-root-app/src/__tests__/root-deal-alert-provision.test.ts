import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../src/db/test-utils";
import { getDealAlertMessage } from "../../../../src/db/repositories/deal-alert-repository";
import { ensureRootRecipientChannel } from "../deal-alert-notifier";
import type { RootCommunityConfig } from "../community-config";
import type { RootDealAlertApi } from "../root-deal-alert-transport";

function createApi() {
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

function createConfig(section: string | undefined = "grp-1"): RootCommunityConfig {
  let alertSectionId = section;
  return {
    async getBroadcastChannelId() {
      return undefined;
    },
    async setBroadcastChannelId() {},
    async getAlertSectionId() {
      return alertSectionId;
    },
    async setAlertSectionId(id) {
      alertSectionId = id;
    },
  };
}

describe("ensureRootRecipientChannel", () => {
  it("creates the private channel with a welcome message and tracks it", async () => {
    const { db } = await createTestDb();
    const fake = createApi();

    const channelId = await ensureRootRecipientChannel("root_user_1", {
      api: fake.api,
      config: createConfig("grp-1"),
      database: db,
    });

    expect(channelId).toBe("chan-1");
    expect(fake.channels).toEqual(["chan-1"]);
    expect(fake.messages[0]).toContain("Deal alerts are on");

    const stored = await getDealAlertMessage("root-alert", "root_user_1", db);
    expect(stored?.channelId).toBe("chan-1");
    expect(stored?.lastListingKeys).toBe("[]");
  });

  it("reuses an existing channel without creating another", async () => {
    const { db } = await createTestDb();
    const fake = createApi();
    const config = createConfig("grp-1");

    await ensureRootRecipientChannel("root_user_1", {
      api: fake.api,
      config,
      database: db,
    });
    const second = await ensureRootRecipientChannel("root_user_1", {
      api: fake.api,
      config,
      database: db,
    });

    expect(second).toBe("chan-1");
    expect(fake.channels).toHaveLength(1);
  });
});
