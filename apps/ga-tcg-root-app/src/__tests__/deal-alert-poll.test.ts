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
        const ref = { channelId: channelId ?? `chan-${recipient}`, messageId: `msg-${next}` };
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
            channelId: null,
            previousMessageIds: [],
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
      channelId: "chan-u2",
      messageId: "old-1",
    });
    expect(api.recordDealAlertCleanup).toHaveBeenCalledWith("u2");
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
