import { describe, it, expect, vi } from "vitest";

vi.mock("@rootsdk/server-app", () => ({
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

function createFakeApi(
  preExisting: string[] = [],
  initialGroupChannels: Array<{ id: string; name: string }> = []
) {
  const channels: Array<Record<string, unknown> & { id: string; name: string }> = [
    ...initialGroupChannels,
  ];
  const messages: Array<Record<string, unknown> & { id: string }> = [];
  const deleted: Array<{ channelId: string; id: string }> = [];
  const deletedChannels: string[] = [];
  const notifications: Array<Record<string, unknown>> = [];
  let nextChannel = 0;
  let nextMessage = 0;

  const api: RootDealAlertApi = {
    everyoneRoleId: "role_everyone",
    botId: "app_bot",
    async createChannel(request) {
      nextChannel += 1;
      const id = `chan-${nextChannel}`;
      channels.push({ ...request, id, name: request.name });
      return { id };
    },
    async createChannelGroup() {
      return { id: "grp-created" };
    },
    async grantBotFullControl() {
      // no-op for the transport suite
    },
    async getMemberName() {
      return "Alice";
    },
    async createMessage(request) {
      nextMessage += 1;
      const id = `msg-${nextMessage}`;
      messages.push({ ...request, id });
      return { id };
    },
    async getChannel(id) {
      if (!channels.some((c) => c.id === id) && !preExisting.includes(id)) {
        throw new Error(`channel not found: ${id}`);
      }
      return { id };
    },
    async listChannels() {
      return channels.map((c) => ({ id: c.id, name: c.name }));
    },
    async deleteMessage(request) {
      deleted.push(request);
    },
    async deleteChannel(id) {
      deletedChannels.push(id);
      const idx = channels.findIndex((c) => c.id === id);
      if (idx >= 0) {
        channels.splice(idx, 1);
      }
    },
    async sendNotification(request) {
      notifications.push(request);
    },
  };

  return { api, channels, messages, deleted, deletedChannels, notifications };
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
    expect(channel.name).toBe("Alice-Wantlist");
    expect(channel.useChannelGroupPermission).toBe(true);
    expect(channel.accessRuleCreates).toEqual([]);

    expect(fake.messages).toEqual([
      { channelId: "chan-1", content: "the list", id: "msg-1" },
    ]);
    expect(ref).toEqual({ channelId: "chan-1", messageId: "msg-1" });
  });

  it("creates the per-user channel without explicit access rules", async () => {
    const fake = createFakeApi();
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    await transport.send("root_user_1", "the list");

    expect(fake.channels[0].accessRuleCreates).toEqual([]);
  });

  it("reuses an existing channel instead of creating a new one", async () => {
    const fake = createFakeApi(["chan-existing"]);
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    const ref = await transport.send("root_user_1", "the list", "chan-existing");

    expect(fake.channels).toHaveLength(0);
    expect(fake.messages[0].channelId).toBe("chan-existing");
    expect(ref?.channelId).toBe("chan-existing");
  });

  it("creates a new channel when the previous channel is gone and cleans up orphaned duplicates", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = createFakeApi([], [
      { id: "orphan-1", name: "Alice-Wantlist" },
      { id: "orphan-2", name: "Alice-Wantlist" },
      { id: "other-chan", name: "market" },
    ]);
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    const ref = await transport.send("root_user_1", "the list", "chan-dead");

    expect(fake.deletedChannels).toEqual(["orphan-1", "orphan-2"]);
    expect(fake.channels.map((c) => c.id)).toEqual(["other-chan", "chan-1"]);
    expect(fake.messages[0].channelId).toBe("chan-1");
    expect(ref?.channelId).toBe("chan-1");
    warnSpy.mockRestore();
  });

  it("reuses verified channel on subsequent chunks without re-querying getChannel", async () => {
    const fake = createFakeApi();
    const getChannelSpy = vi.spyOn(fake.api, "getChannel");
    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    const ref1 = await transport.send("root_user_1", "chunk 1");
    const ref2 = await transport.send("root_user_1", "chunk 2", ref1?.channelId);

    expect(fake.channels).toHaveLength(1);
    expect(getChannelSpy).not.toHaveBeenCalled();
    expect(ref2).toEqual({ channelId: "chan-1", messageId: "msg-2" });
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

  it("swallows and logs deleteMessage errors so stale messages never abort delivery", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = createFakeApi();
    fake.api.deleteMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("NoPermissionToDelete(1004)"))
      .mockResolvedValueOnce(undefined);

    const transport = createRootDealAlertTransport({
      channelGroupId: "section_1",
      api: fake.api,
    });

    await expect(
      transport.delete({ channelId: "chan-dead", messageId: "msg-1,msg-2" })
    ).resolves.toBeUndefined();

    expect(fake.api.deleteMessage).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not delete message msg-1 in channel chan-dead"),
      expect.stringContaining("NoPermissionToDelete(1004)")
    );
    warnSpy.mockRestore();
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
