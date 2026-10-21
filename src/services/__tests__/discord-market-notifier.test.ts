import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { marketNotifications, marketStores } from "../../db/schema";
import type { MarketNotification } from "../../db/repositories/marketplace-repository";
import {
 groupMarketNotificationsByStore,
 formatMarketNotificationMessage,
 formatMarketNotificationDate,
} from "../market-notification-formatter";
import {
 DISCORD_MESSAGE_MAX_LENGTH,
 escapeDiscordMarkdown,
 formatDiscordCardLine,
 formatDiscordMarketNotificationMessage,
 splitDiscordContent,
} from "../discord-market-notification-formatter";
import {
 redactWebhookSecret,
 sendDiscordWebhookMessage,
 validateDiscordWebhookUrl,
} from "../discord-webhook";
import {
 deliverDiscordNotifications,
 DiscordMarketNotificationSink,
} from "../discord-market-notifier";
import {
 deliverMarketNotifications,
 type MarketNotificationSink,
} from "../market-notification-sink";
import { getUndeliveredNotifications, markNotificationsDelivered, DISCORD_DESTINATION } from "../../db/repositories/notification-delivery-repository";

function makeNotification(overrides: Partial<MarketNotification> = {}): MarketNotification {
 return {
  id: "notif-1",
  storeId: "myp",
  cardName: "Flame-Rune Swordsman",
  setPrefix: "FTC",
  collectorNumber: "136",
  isFoil: false,
  price: "R$ 15,00",
  refId: "ref_136",
  imageUrl: "https://example.com/card.jpg",
  detectedAt: new Date("2026-10-21T02:00:00Z"),
  sentAt: null,
  messageId: null,
  createdAt: new Date("2026-10-21T02:00:00Z"),
  ...overrides,
 };
}

const fixedDate = new Date(2026, 9, 21);
const expectedDateStr = fixedDate.toLocaleDateString("pt-BR");

describe("shared market notification formatter", () => {
 it("groups notifications by store id", () => {
  const grouped = groupMarketNotificationsByStore([
   makeNotification({ id: "a", storeId: "myp" }),
   makeNotification({ id: "b", storeId: "brandao" }),
   makeNotification({ id: "c", storeId: "myp" }),
  ]);

  expect([...grouped.keys()]).toEqual(["myp", "brandao"]);
  expect(grouped.get("myp")?.map((n) => n.id)).toEqual(["a", "c"]);
 });

 it("formats the pt-BR date like the Root bot", () => {
  expect(formatMarketNotificationDate(fixedDate)).toBe(expectedDateStr);
 });
});

describe("formatMarketNotificationMessage (Root, byte-for-byte)", () => {
 it("produces the exact Root message for a single non-foil card", () => {
  const result = formatMarketNotificationMessage(
   [makeNotification()],
   "Brandao Card Game",
   fixedDate
  );

  expect(result).toBe(
   `**Brandao Card Game** updated their stock!\n` +
    `New cards since ${expectedDateStr}:\n` +
    `• Flame-Rune Swordsman — FTC 136 — R$ 15,00`
  );
 });

 it("produces the exact Root message for a foil card with no collector number", () => {
  const result = formatMarketNotificationMessage(
   [
    makeNotification({
     id: "notif-foil",
     cardName: "Frostbind",
     collectorNumber: "",
     isFoil: true,
     price: "R$ 45,00",
    }),
   ],
   "Brandao Card Game",
   fixedDate
  );

  expect(result).toBe(
   `**Brandao Card Game** updated their stock!\n` +
    `New cards since ${expectedDateStr}:\n` +
    `• Frostbind — FTC (Foil) — R$ 45,00`
  );
 });
});

describe("formatDiscordMarketNotificationMessage", () => {
 it("returns no chunks for an empty batch", () => {
  expect(formatDiscordMarketNotificationMessage([], "Store")).toEqual([]);
 });

 it("links card names only for valid https product URLs", () => {
  const withLink = makeNotification({ imageUrl: "https://mypcards.com/product/1" });
  const withBadUrl = makeNotification({
   id: "bad",
   imageUrl: "http://insecure.example.com/product",
  });
  const withNoUrl = makeNotification({ id: "none", imageUrl: null });

  const [linkLine, badLine, noUrlLine] = formatDiscordMarketNotificationMessage(
   [withLink, withBadUrl, withNoUrl],
   "Store",
   fixedDate
  )[0]
   .split("\n")
   .slice(2);

  expect(linkLine).toBe(
   "• [Flame-Rune Swordsman](https://mypcards.com/product/1) — FTC 136 — R$ 15,00"
  );
  expect(badLine).toBe("• Flame-Rune Swordsman — FTC 136 — R$ 15,00");
  expect(noUrlLine).toBe("• Flame-Rune Swordsman — FTC 136 — R$ 15,00");
 });

 it("escapes Markdown and mention characters in card and store names", () => {
  const hostile = makeNotification({
   cardName: "@everyone *bold* #channel `code`",
   imageUrl: null,
  });

  const [message] = formatDiscordMarketNotificationMessage(
   [hostile],
   "Store _Italic_",
   fixedDate
  );

  expect(message).toContain("**Store \\_Italic\\_** updated their stock!");
  expect(message).toContain(
   "• \\@everyone \\*bold\\* \\#channel \\`code\\` — FTC 136 — R$ 15,00"
  );
 });

 it("matches the Root card line byte-for-byte when nothing needs escaping", () => {
  const notification = makeNotification({ imageUrl: null });
  const [message] = formatDiscordMarketNotificationMessage(
   [notification],
   "Brandao Card Game",
   fixedDate
  );
  const root = formatMarketNotificationMessage(
   [notification],
   "Brandao Card Game",
   fixedDate
  );

  expect(message).toBe(root);
 });

 it("keeps the allowed_mentions-safe content for @everyone-like card names", () => {
  const [message] = formatDiscordMarketNotificationMessage(
   [makeNotification({ cardName: "@here" })],
   "Store",
   fixedDate
  );
  expect(message).toContain("\\@here");
  expect(message).not.toContain(" @here");
 });
});

describe("splitDiscordContent", () => {
 it("returns a single chunk when under the limit", () => {
  expect(splitDiscordContent("short", 100)).toEqual(["short"]);
 });

 it("splits on line boundaries and never exceeds the limit", () => {
  const line = `• ${"x".repeat(600)}`;
  const message = [line, line, line, line].join("\n");

  const chunks = splitDiscordContent(message, DISCORD_MESSAGE_MAX_LENGTH);

  for (const chunk of chunks) {
   expect(chunk.length).toBeLessThanOrEqual(DISCORD_MESSAGE_MAX_LENGTH);
  }
  // 4 lines of 604 chars => pairs fit (1209 < 2000), so exactly two chunks.
  expect(chunks).toHaveLength(2);
 });

 it("hard-slices a single over-long line", () => {
  const chunks = splitDiscordContent("a".repeat(4500), DISCORD_MESSAGE_MAX_LENGTH);
  expect(chunks).toHaveLength(3);
  for (const chunk of chunks) {
   expect(chunk.length).toBeLessThanOrEqual(DISCORD_MESSAGE_MAX_LENGTH);
  }
 });
});

describe("escapeDiscordMarkdown", () => {
 it("escapes every markdown and mention metacharacter", () => {
  expect(escapeDiscordMarkdown("*_~`|>@#:\\")).toBe(
   "\\*\\_\\~\\`\\|\\>\\@\\#\\:\\\\"
  );
 });
});

describe("validateDiscordWebhookUrl", () => {
 it("accepts discord.com and discordapp.com https webhook paths", () => {
  expect(
   validateDiscordWebhookUrl("https://discord.com/api/webhooks/123/token")
  ).toBe("https://discord.com/api/webhooks/123/token");
  expect(
   validateDiscordWebhookUrl("https://discordapp.com/api/webhooks/123/token")
  ).toBe("https://discordapp.com/api/webhooks/123/token");
 });

 it("rejects non-https, foreign hosts, and non-webhook paths", () => {
  expect(validateDiscordWebhookUrl("http://discord.com/api/webhooks/1/t")).toBeNull();
  expect(validateDiscordWebhookUrl("https://evil.com/api/webhooks/1/t")).toBeNull();
  expect(validateDiscordWebhookUrl("https://discord.com/api/other/1/t")).toBeNull();
  expect(validateDiscordWebhookUrl("")).toBeNull();
  expect(validateDiscordWebhookUrl(undefined)).toBeNull();
  expect(validateDiscordWebhookUrl("not a url")).toBeNull();
 });
});

describe("redactWebhookSecret", () => {
 const webhookUrl = "https://discord.com/api/webhooks/123456789/secret-token-abc";

 it("redacts the full webhook URL", () => {
  const message = `fetch failed for ${webhookUrl}?wait=true`;
  const redacted = redactWebhookSecret(message, webhookUrl);

  expect(redacted).not.toContain(webhookUrl);
  expect(redacted).not.toContain("secret-token-abc");
  expect(redacted).toContain("[REDACTED_WEBHOOK]");
 });

 it("redacts the bare token when it appears without the URL", () => {
  const message = "Discord webhook request failed: token secret-token-abc rejected";
  const redacted = redactWebhookSecret(message, webhookUrl);

  expect(redacted).not.toContain("secret-token-abc");
  expect(redacted).toContain("[REDACTED]");
 });

 it("redacts any discord webhook URL even when it differs from the configured one", () => {
  const message = "see https://discord.com/api/webhooks/999/other-token for details";
  const redacted = redactWebhookSecret(message, webhookUrl);

  expect(redacted).not.toContain("other-token");
  expect(redacted).toContain("[REDACTED_WEBHOOK]");
 });
});

describe("sendDiscordWebhookMessage", () => {
 afterEach(() => {
  vi.restoreAllMocks();
 });

 function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
   status,
   headers: { "Content-Type": "application/json", ...headers },
  });
 }

 it("posts JSON with wait=true and allowed_mentions and returns the message id", async () => {
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
   expect(_url).toContain("wait=true");
   const body = JSON.parse(String(init?.body));
   expect(body.allowed_mentions).toEqual({ parse: [] });
   return jsonResponse(200, { id: "msg-42" });
  }) as unknown as typeof fetch;

  const messageId = await sendDiscordWebhookMessage(
   "https://discord.com/api/webhooks/1/token",
   "hello",
   { fetchImpl }
  );

  expect(messageId).toBe("msg-42");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });

 it("honors retry_after on 429 then succeeds", async () => {
  const sleep = vi.fn(async () => {});
  const fetchImpl = vi
   .fn()
   .mockResolvedValueOnce(jsonResponse(429, {}, { "retry-after": "1.5" }))
   .mockResolvedValueOnce(jsonResponse(200, { id: "msg-2" })) as unknown as typeof fetch;

  const messageId = await sendDiscordWebhookMessage(
   "https://discord.com/api/webhooks/1/token",
   "hello",
   { fetchImpl, sleep, maxRetries: 2, maxRetryDelayMs: 5000 }
  );

  expect(messageId).toBe("msg-2");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledWith(1500);
 });

 it("gives up after bounded 429 retries and returns null", async () => {
  const sleep = vi.fn(async () => {});
  const fetchImpl = vi
   .fn()
   .mockResolvedValue(jsonResponse(429, {}, { "retry-after": "0.1" })) as unknown as typeof fetch;

  const messageId = await sendDiscordWebhookMessage(
   "https://discord.com/api/webhooks/1/token",
   "hello",
   { fetchImpl, sleep, maxRetries: 1, maxRetryDelayMs: 5000 }
  );

  expect(messageId).toBeNull();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
 });

 it("returns null on non-2xx responses", async () => {
  const fetchImpl = vi
   .fn()
   .mockResolvedValue(jsonResponse(400, { message: "bad" })) as unknown as typeof fetch;

  const messageId = await sendDiscordWebhookMessage(
   "https://discord.com/api/webhooks/1/token",
   "hello",
   { fetchImpl }
  );

  expect(messageId).toBeNull();
 });

 it("redacts the webhook secret from network error warnings", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const webhookUrl = "https://discord.com/api/webhooks/123/secret-token";
  const fetchImpl = vi.fn(async () => {
   throw new Error(`network down for ${webhookUrl}`);
  }) as unknown as typeof fetch;

  const messageId = await sendDiscordWebhookMessage(webhookUrl, "hello", { fetchImpl });

  expect(messageId).toBeNull();
  const warning = warn.mock.calls.flat().join(" ");
  expect(warning).not.toContain("secret-token");
  expect(warning).not.toContain(webhookUrl);
  expect(warning).toContain("[REDACTED_WEBHOOK]");
 });
});

describe("deliverMarketNotifications", () => {
 it("delivers grouped notifications and marks them delivered", async () => {
  const { db } = await createTestDb();

  await db.insert(marketStores).values({
   id: "brandao",
   platform: "liga_store",
   name: "MyP Cards",
   baseUrl: "https://mypcards.com",
   lastFullScanAt: fixedDate,
  });
  await db.insert(marketNotifications).values([
   makeNotification({ id: "n1", storeId: "brandao" }),
   makeNotification({ id: "n2", storeId: "brandao" }),
  ]);

  const sink: MarketNotificationSink = {
   destination: "discord",
   formatGroup: (notifications, storeName) => [`${storeName}:${notifications.length}`],
   send: vi.fn(async () => "msg-1"),
   markDelivered: async (ids, messageId, database) => {
    await markNotificationsDelivered(ids, DISCORD_DESTINATION, messageId, undefined, database);
   },
  };

  const result = await deliverMarketNotifications(sink, db);

  expect(result).toEqual({ attempted: 2, delivered: 2 });
  expect(sink.send).toHaveBeenCalledWith("MyP Cards:2");

  const remaining = await getUndeliveredNotifications("discord", db);
  expect(remaining).toHaveLength(0);
 });

 it("leaves rows undelivered when a send fails", async () => {
  const { db } = await createTestDb();

  await db.insert(marketStores).values({
   id: "brandao",
   platform: "liga_store",
   name: "MyP Cards",
   baseUrl: "https://mypcards.com",
  });
  await db.insert(marketNotifications).values([
   makeNotification({ id: "n1", storeId: "brandao" }),
  ]);

  const sink: MarketNotificationSink = {
   destination: "discord",
   formatGroup: () => ["chunk"],
   send: vi.fn(async () => null),
   markDelivered: vi.fn(async () => {}),
  };

  const result = await deliverMarketNotifications(sink, db);

  expect(result).toEqual({ attempted: 1, delivered: 0 });
  expect(sink.markDelivered).not.toHaveBeenCalled();

  const remaining = await getUndeliveredNotifications("discord", db);
  expect(remaining.map((n) => n.id)).toEqual(["n1"]);
 });
});

describe("deliverDiscordNotifications", () => {
 afterEach(() => {
  delete process.env.DISCORD_WEBHOOK;
  vi.restoreAllMocks();
 });

 it("disables without throwing when DISCORD_WEBHOOK is missing or invalid", async () => {
  delete process.env.DISCORD_WEBHOOK;
  await expect(deliverDiscordNotifications()).resolves.toEqual({
   disabled: true,
   attempted: 0,
   delivered: 0,
  });

  process.env.DISCORD_WEBHOOK = "not-a-webhook";
  await expect(deliverDiscordNotifications()).resolves.toEqual({
   disabled: true,
   attempted: 0,
   delivered: 0,
  });
 });
});

describe("DiscordMarketNotificationSink", () => {
 it("uses the discord destination and delegates formatting", () => {
  const sink = new DiscordMarketNotificationSink("https://discord.com/api/webhooks/1/t");

  expect(sink.destination).toBe("discord");
  expect(sink.formatGroup([makeNotification()], "Store", fixedDate)).toEqual([
   `**Store** updated their stock!\n` +
    `New cards since ${expectedDateStr}:\n` +
    "• [Flame-Rune Swordsman](https://example.com/card.jpg) — FTC 136 — R$ 15,00",
  ]);
 });

 it("formatDiscordCardLine escapes a hostile card name", () => {
  const line = formatDiscordCardLine(
   makeNotification({ cardName: "A @everyone", imageUrl: null })
  );
  expect(line).toBe("• A \\@everyone — FTC 136 — R$ 15,00");
 });
});
