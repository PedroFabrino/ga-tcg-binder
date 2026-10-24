import { describe, expect, it } from "vitest";
import {
  createCommunityConfig,
  type CommunityConfigStore,
} from "../community-config";

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const store: CommunityConfigStore = {
    async get<T>(key: string) {
      return data.get(key) as T | undefined;
    },
    async set<T>({ key, value }: { key: string; value: T }) {
      data.set(key, value);
    },
  };
  return { store, data };
}

describe("Root community config", () => {
  it("round-trips the broadcast channel and alert section ids", async () => {
    const { store } = fakeStore();
    const config = createCommunityConfig(store);

    expect(await config.getBroadcastChannelId()).toBeUndefined();
    expect(await config.getAlertSectionId()).toBeUndefined();

    await config.setBroadcastChannelId("chan-1");
    await config.setAlertSectionId("grp-1");

    expect(await config.getBroadcastChannelId()).toBe("chan-1");
    expect(await config.getAlertSectionId()).toBe("grp-1");
  });

  it("returns undefined for missing values without throwing", async () => {
    const { store } = fakeStore();
    const config = createCommunityConfig(store);

    await expect(config.getBroadcastChannelId()).resolves.toBeUndefined();
    await expect(config.getAlertSectionId()).resolves.toBeUndefined();
  });
});
