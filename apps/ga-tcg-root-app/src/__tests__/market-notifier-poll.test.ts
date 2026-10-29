import { describe, expect, it, vi } from "vitest";
import { runMarketNotificationPoll } from "../market-notifier";

describe("runMarketNotificationPoll", () => {
  it("posts each chunk and marks it delivered", async () => {
    const api = {
      getMarketNotifications: vi.fn().mockResolvedValue({
        chunks: [
          { storeId: "s", storeName: "MyP", content: "c1", notificationIds: ["n1"] },
          { storeId: "s", storeName: "MyP", content: "c2", notificationIds: ["n2"] },
        ],
      }),
      markMarketNotificationsDelivered: vi.fn().mockResolvedValue(undefined),
    };
    const config = { getBroadcastChannelId: vi.fn().mockResolvedValue("chan-1") };
    const postMessage = vi
      .fn()
      .mockResolvedValueOnce("m1")
      .mockResolvedValueOnce("m2");

    await runMarketNotificationPoll({ api, config, postMessage });

    expect(postMessage).toHaveBeenNthCalledWith(1, "chan-1", "c1");
    expect(api.markMarketNotificationsDelivered).toHaveBeenNthCalledWith(1, {
      notificationIds: ["n1"],
      messageIds: ["m1"],
    });
    expect(api.markMarketNotificationsDelivered).toHaveBeenNthCalledWith(2, {
      notificationIds: ["n2"],
      messageIds: ["m2"],
    });
  });

  it("passes configured broadcastLocale to getMarketNotifications", async () => {
    const api = {
      getMarketNotifications: vi.fn().mockResolvedValue({ chunks: [] }),
      markMarketNotificationsDelivered: vi.fn(),
    };
    const config = {
      getBroadcastChannelId: vi.fn().mockResolvedValue("chan-1"),
      getBroadcastLocale: vi.fn().mockResolvedValue("pt-BR"),
    };

    await runMarketNotificationPoll({ api, config, postMessage: vi.fn() });

    expect(api.getMarketNotifications).toHaveBeenCalledWith("pt-BR");
  });

  it("does nothing when no broadcast channel is configured", async () => {
    const api = {
      getMarketNotifications: vi.fn(),
      markMarketNotificationsDelivered: vi.fn(),
    };
    const config = { getBroadcastChannelId: vi.fn().mockResolvedValue(undefined) };
    const warn = vi.fn();

    await runMarketNotificationPoll({
      api,
      config,
      postMessage: vi.fn(),
      warn,
    });

    expect(api.getMarketNotifications).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "No broadcast channel configured — select a channel in the Assistant App GUI. Market notifications paused."
    );
  });

  it("leaves the chunk undelivered when the post throws", async () => {
    const api = {
      getMarketNotifications: vi.fn().mockResolvedValue({
        chunks: [
          { storeId: "s", storeName: "MyP", content: "c1", notificationIds: ["n1"] },
          { storeId: "s", storeName: "MyP", content: "c2", notificationIds: ["n2"] },
        ],
      }),
      markMarketNotificationsDelivered: vi.fn(),
    };
    const config = { getBroadcastChannelId: vi.fn().mockResolvedValue("chan-1") };
    const postMessage = vi.fn().mockRejectedValueOnce(new Error("boom"));

    await expect(
      runMarketNotificationPoll({ api, config, postMessage })
    ).rejects.toThrow("boom");

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(api.markMarketNotificationsDelivered).not.toHaveBeenCalled();
  });

  it("records delivery when a posted chunk has no message id", async () => {
    const api = {
      getMarketNotifications: vi.fn().mockResolvedValue({
        chunks: [
          { storeId: "s", storeName: "MyP", content: "c1", notificationIds: ["n1"] },
        ],
      }),
      markMarketNotificationsDelivered: vi.fn().mockResolvedValue(undefined),
    };
    const config = { getBroadcastChannelId: vi.fn().mockResolvedValue("chan-1") };
    const warn = vi.fn();

    await runMarketNotificationPoll({
      api,
      config,
      postMessage: vi.fn().mockResolvedValue(null),
      warn,
    });

    expect(api.markMarketNotificationsDelivered).toHaveBeenCalledWith({
      notificationIds: ["n1"],
      messageIds: [],
    });
    expect(warn).toHaveBeenCalled();
  });
});
