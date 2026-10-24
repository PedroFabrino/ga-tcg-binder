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
    expect(warn).toHaveBeenCalled();
  });

  it("stops on the first failed post so the remainder retries", async () => {
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
    const postMessage = vi.fn().mockResolvedValueOnce(null);

    await runMarketNotificationPoll({ api, config, postMessage });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(api.markMarketNotificationsDelivered).not.toHaveBeenCalled();
  });
});
