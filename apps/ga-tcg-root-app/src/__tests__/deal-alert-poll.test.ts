import { describe, expect, it, vi } from "vitest";
import { runDealAlertPoll } from "../deal-alert-notifier";

function fakeTransport() {
  const sent: Array<{ recipient: string; content: string }> = [];
  const deleted: Array<{ channelId: string; messageId: string }> = [];
  const notified: Array<{ recipient: string; summary: unknown }> = [];
  let next = 0;

  return {
    transport: {
      async send(recipient: string, content: string, channelId?: string) {
        next += 1;
        const ref = {
          channelId: channelId ?? `chan-${recipient}`,
          messageId: `msg-${next}`,
        };
        sent.push({ recipient, content });
        return ref;
      },
      async delete(ref: { channelId: string; messageId: string }) {
        deleted.push(ref);
      },
      async notify(recipient: string, summary: unknown) {
        notified.push({ recipient, summary });
      },
    },
    sent,
    deleted,
    notified,
  };
}

describe("runDealAlertPoll", () => {
  it("delivers changed plans, cleans up stale ones, and reports", async () => {
    const api = {
      getDealAlerts: vi.fn().mockResolvedValue({
        plans: [
          {
            recipientId: "u1",
            channelId: "chan-u1",
            previousMessageIds: ["prev-1"],
            chunks: ["c1"],
            summary: { title: "t", description: "d" },
            lastListingKeys: ["k1"],
          },
        ],
        cleanup: [
          { recipientId: "u2", channelId: "chan-u2", messageIds: ["old-1"] },
        ],
      }),
      recordDealAlertDelivery: vi.fn().mockResolvedValue(undefined),
      recordDealAlertCleanup: vi.fn().mockResolvedValue(undefined),
    };
    const fake = fakeTransport();

    await runDealAlertPoll({
      api,
      ensureSection: async () => "sec-1",
      createTransport: () => fake.transport,
    });

    expect(fake.sent[0]).toEqual({ recipient: "u1", content: "c1" });
    expect(fake.notified[0]).toMatchObject({ recipient: "u1" });
    expect(api.recordDealAlertDelivery).toHaveBeenCalledWith({
      recipientId: "u1",
      channelId: "chan-u1",
      messageIds: ["msg-1"],
      lastListingKeys: ["k1"],
    });
    expect(fake.deleted).toContainEqual({
      channelId: "chan-u1",
      messageId: "prev-1",
    });
    expect(fake.deleted).toContainEqual({
      channelId: "chan-u2",
      messageId: "old-1",
    });
    expect(api.recordDealAlertCleanup).toHaveBeenCalledWith("u2");
  });

  it("skips deleting previous messages when a stale channel was replaced with a new channel", async () => {
    const api = {
      getDealAlerts: vi.fn().mockResolvedValue({
        plans: [
          {
            recipientId: "u1",
            channelId: "chan-stale-deleted",
            previousMessageIds: ["msg-stale-1", "msg-stale-2"],
            chunks: ["c1", "c2"],
            summary: { title: "t", description: "d" },
            lastListingKeys: ["k1"],
          },
        ],
        cleanup: [],
      }),
      recordDealAlertDelivery: vi.fn().mockResolvedValue(undefined),
      recordDealAlertCleanup: vi.fn().mockResolvedValue(undefined),
    };

    const transport = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ channelId: "chan-fresh", messageId: "m1" })
        .mockResolvedValueOnce({ channelId: "chan-fresh", messageId: "m2" }),
      delete: vi.fn(),
      notify: vi.fn().mockResolvedValue(undefined),
    };

    await runDealAlertPoll({
      api,
      ensureSection: async () => "sec-1",
      createTransport: () => transport,
    });

    expect(transport.delete).not.toHaveBeenCalled();
    expect(api.recordDealAlertDelivery).toHaveBeenCalledWith({
      recipientId: "u1",
      channelId: "chan-fresh",
      messageIds: ["m1", "m2"],
      lastListingKeys: ["k1"],
    });
  });

  it("records delivery even when deleting previous messages or notifying fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = {
      getDealAlerts: vi.fn().mockResolvedValue({
        plans: [
          {
            recipientId: "u1",
            channelId: "chan-u1",
            previousMessageIds: ["old-msg"],
            chunks: ["c1"],
            summary: { title: "t", description: "d" },
            lastListingKeys: ["k1"],
          },
        ],
        cleanup: [
          { recipientId: "u2", channelId: "chan-u2", messageIds: ["cleanup-msg"] },
        ],
      }),
      recordDealAlertDelivery: vi.fn().mockResolvedValue(undefined),
      recordDealAlertCleanup: vi.fn().mockResolvedValue(undefined),
    };

    const transport = {
      send: vi
        .fn()
        .mockResolvedValue({ channelId: "chan-u1", messageId: "new-msg" }),
      delete: vi.fn().mockRejectedValue(new Error("NoPermissionToDelete(1004)")),
      notify: vi.fn().mockRejectedValue(new Error("Notify unavailable")),
    };

    await runDealAlertPoll({
      api,
      ensureSection: async () => "sec-1",
      createTransport: () => transport,
    });

    expect(api.recordDealAlertCleanup).toHaveBeenCalledWith("u2");
    expect(api.recordDealAlertDelivery).toHaveBeenCalledWith({
      recipientId: "u1",
      channelId: "chan-u1",
      messageIds: ["new-msg"],
      lastListingKeys: ["k1"],
    });
    warnSpy.mockRestore();
  });

  it("does not report a plan when a chunk fails", async () => {
    const api = {
      getDealAlerts: vi.fn().mockResolvedValue({
        plans: [
          {
            recipientId: "u1",
            channelId: null,
            previousMessageIds: [],
            chunks: ["c1", "c2"],
            summary: { title: "t", description: "d" },
            lastListingKeys: ["k"],
          },
        ],
        cleanup: [],
      }),
      recordDealAlertDelivery: vi.fn(),
      recordDealAlertCleanup: vi.fn(),
    };
    const transport = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ channelId: "chan-u1", messageId: "m1" })
        .mockResolvedValueOnce(null),
      delete: vi.fn(),
      notify: vi.fn(),
    };

    await runDealAlertPoll({
      api,
      ensureSection: async () => "sec",
      createTransport: () => transport,
    });

    expect(api.recordDealAlertDelivery).not.toHaveBeenCalled();
    expect(transport.delete).toHaveBeenCalledWith({
      channelId: "chan-u1",
      messageId: "m1",
    });
  });
});
