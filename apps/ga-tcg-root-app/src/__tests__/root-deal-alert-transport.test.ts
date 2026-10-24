import { describe, it, expect, vi } from "vitest";

vi.mock("@rootsdk/server-bot", () => ({
  ChannelType: { Text: 1, ThreadedText: 2 },
  WellKnownRootGuids: {
    CommunityRoles: { EveryoneRole: "role_everyone" },
  },
  rootServer: { community: {} },
}));

import {
  createRootDealAlertTransport,
  type RootDealAlertApi,
} from "../root-deal-alert-transport";

function createFakeApi() {
  const channels: Array<Record<string, unknown> & { id: string }> = [];
  const messages: Array<Record<string, unknown> & { id: string }> = [];
  const deleted: Array<{ channelId: string; id: string }> = [];
  const notifications: Array<Record<string, unknown>> = [];
  let nextChannel = 0;
  let nextMessage = 0;

  const api: RootDealAlertApi = {
    everyoneRoleId: "role_everyone",
    async createChannel(request) {
      nextChannel += 1;
      const id = `chan-${nextChannel}`;
      channels.push({ ...request, id });
      return { id };
    },
    async createMessage(request) {
      nextMessage += 1;
      const id = `msg-${nextMessage}`;
      messages.push({ ...request, id });
      return { id };
    },
    async deleteMessage(request) {
      deleted.push(request);
    },
    async sendNotification(request) {
      notifications.push(request);
    },
  };

  return { api, channels, messages, deleted, notifications };
}

describe("Root deal-alert transport", () => {
  it("creates a private per-user channel and posts the rolling message", async () => {
    const fake = createFakeApi();
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    const ref = await transport.send("root_user_1", "the list");

    expect(fake.channels).toHaveLength(1);
    const channel = fake.channels[0];
    expect(channel.channelGroupId).toBe("section_1");
    expect(channel.name).toBe("ga-alerts-root_user_1");
    expect(channel.useChannelGroupPermission).toBe(false);
    expect(channel.accessRuleCreates).toEqual([
      { roleOrMemberId: "role_everyone", overlay: { channelView: false } },
      {
        roleOrMemberId: "root_user_1",
        overlay: {
          channelView: true,
          channelCreateMessage: true,
          channelViewMessageHistory: true,
        },
      },
    ]);

    expect(fake.messages).toEqual([
      { channelId: "chan-1", content: "the list", id: "msg-1" },
    ]);
    expect(ref).toEqual({ channelId: "chan-1", messageId: "msg-1" });
  });

  it("reuses an existing channel instead of creating a new one", async () => {
    const fake = createFakeApi();
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    const ref = await transport.send("root_user_1", "the list", "chan-existing");

    expect(fake.channels).toHaveLength(0);
    expect(fake.messages[0].channelId).toBe("chan-existing");
    expect(ref?.channelId).toBe("chan-existing");
  });

  it("deletes every message id in a comma-separated reference", async () => {
    const fake = createFakeApi();
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    await transport.delete({ channelId: "chan-1", messageId: "msg-1,msg-2" });

    expect(fake.deleted).toEqual([
      { channelId: "chan-1", id: "msg-1" },
      { channelId: "chan-1", id: "msg-2" },
    ]);
  });

  it("sends a summary notification to the recipient", async () => {
    const fake = createFakeApi();
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    await transport.notify?.("root_user_1", {
      title: "🔔 2 new cards for your wantlist",
      description: "Cards: Alpha and Beta for sale!",
    });

    expect(fake.notifications).toEqual([
      {
        userIds: ["root_user_1"],
        title: "🔔 2 new cards for your wantlist",
        description: "Cards: Alpha and Beta for sale!",
      },
    ]);
  });
});
