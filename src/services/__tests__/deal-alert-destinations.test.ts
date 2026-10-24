import { describe, expect, it, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { createTestDb } from "../../db/test-utils";
import { runMigrations } from "../../db/init";
import {
  users,
  collectorIdentities,
  cards,
  decks,
  deckCards,
  marketStores,
  marketCards,
} from "../../db/schema";
import { getDealAlertMessage } from "../../db/repositories/deal-alert-repository";
import {
  adaptDirectMessageSink,
  dispatchDealAlerts,
  matchDealAlerts,
  type DealAlertMatch,
} from "../discord-deal-notifier";
import {
  formatDealAlertNotificationSummary,
  type DealAlertSource,
} from "../deal-alert-format";
import type {
  DirectMessageSink,
  DirectMessageRef,
} from "../market-notification-sink";
import type { MarketCard } from "../../db/schema";

const ROOT_USER_ID = "root_user_1";

function createFakeRootTransport() {
  const sent: Array<{
    recipient: string;
    content: string;
    channelId: string;
    messageId: string;
  }> = [];
  const notified: Array<{
    recipient: string;
    summary: ReturnType<typeof formatDealAlertNotificationSummary>;
  }> = [];
  const deleted: DirectMessageRef[] = [];
  let nextId = 0;

  const transport: DirectMessageSink = {
    async send(recipient, content, previousChannelId) {
      nextId += 1;
      const channelId = previousChannelId ?? `root-channel-${recipient}`;
      const messageId = `root-msg-${nextId}`;
      sent.push({ recipient, content, channelId, messageId });
      return { channelId, messageId };
    },
    async delete(ref) {
      deleted.push(ref);
    },
    async notify(recipient, summary) {
      notified.push({ recipient, summary });
    },
  };

  return { transport, sent, notified, deleted };
}

function makeMatch(cardName: string, source: DealAlertSource): DealAlertMatch {
  return {
    collectorId: "collector_1",
    recipientId: "recipient_1",
    listing: { cardName } as MarketCard,
    source,
  };
}

const HARD_SOURCE: DealAlertSource = {
  kind: "hard",
  deckId: "deck_1",
  deckName: "Burn",
  missingQuantity: 1,
};

describe("deal alert destinations", () => {
  let db: any;

  const listing: MarketCard = {
    id: "mc_root_1",
    storeId: "store_myp",
    cardSlug: "creative-shock",
    editionId: null,
    rawName: "Creative Shock",
    cardName: "Creative Shock",
    setPrefix: "DOA",
    quantity: 1,
    price: "R$ 55,00",
    priceNumeric: 55,
    tcgPrice: null,
    tcgPriceNumeric: null,
    quality: "NM",
    isFoil: true,
    itemId: "item_root_1",
    productUrl: "https://myp.local/shock",
    vendorName: "Camelot Cards",
    vendorUrl: null,
    firstSeenAt: new Date(),
    lastStockedAt: null,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    await db.insert(users).values({
      id: "user_root_1",
      name: "Rooty",
      email: "rooty@camelot.local",
      friendCode: "GA-ROOTY1",
      locale: "en",
    });

    await db.insert(cards).values({
      slug: "creative-shock",
      name: "Creative Shock",
      element: "water",
      class: "mage",
      type: "action",
    });

    await db.insert(collectorIdentities).values({
      id: "ident_root",
      collectorId: "user_root_1",
      provider: "root",
      providerUserId: ROOT_USER_ID,
      wantlistNotificationsEnabled: true,
      linkedAt: new Date(),
    });

    await db.insert(decks).values({
      id: "deck_root",
      userId: "user_root_1",
      name: "Burn Deck",
      format: "standard",
    });

    await db.insert(deckCards).values({
      id: "dc_root_1",
      deckId: "deck_root",
      cardSlug: "creative-shock",
      zone: "main",
      quantity: 4,
    });

    await db.insert(marketStores).values({
      id: "store_myp",
      platform: "myp",
      name: "MyP",
      baseUrl: "https://mypcards.com",
    });

    await db.insert(marketCards).values(listing);
  });

  it("matches providers independently", async () => {
    const rootMatches = await matchDealAlerts([listing], db, "root");
    const discordMatches = await matchDealAlerts([listing], db, "discord");

    expect(rootMatches).toHaveLength(1);
    expect(rootMatches[0].recipientId).toBe(ROOT_USER_ID);
    expect(discordMatches).toHaveLength(0);
  });

  it("dispatches root alerts to the root-alert destination and pings once", async () => {
    const fake = createFakeRootTransport();
    const now = new Date("2026-10-24T12:00:00Z");

    const result = await dispatchDealAlerts(
      db,
      adaptDirectMessageSink(fake.transport),
      now,
      { destination: "root-alert" }
    );

    expect(result.sent).toBe(1);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].recipient).toBe(ROOT_USER_ID);
    expect(fake.sent[0].channelId).toBe(`root-channel-${ROOT_USER_ID}`);

    expect(fake.notified).toHaveLength(1);
    expect(fake.notified[0].recipient).toBe(ROOT_USER_ID);
    expect(fake.notified[0].summary.description).toContain("Creative Shock");

    const rootRow = await getDealAlertMessage("root-alert", ROOT_USER_ID, db);
    expect(rootRow?.destination).toBe("root-alert");
    expect(rootRow?.recipientId).toBe(ROOT_USER_ID);

    const discordRow = await getDealAlertMessage("discord-dm", ROOT_USER_ID, db);
    expect(discordRow).toBeUndefined();
  });

  it("does not re-send or re-notify when the list is unchanged", async () => {
    const first = createFakeRootTransport();
    await dispatchDealAlerts(
      db,
      adaptDirectMessageSink(first.transport),
      new Date(),
      { destination: "root-alert" }
    );
    expect(first.sent).toHaveLength(1);
    expect(first.notified).toHaveLength(1);

    const second = createFakeRootTransport();
    await dispatchDealAlerts(
      db,
      adaptDirectMessageSink(second.transport),
      new Date(),
      { destination: "root-alert" }
    );
    expect(second.sent).toHaveLength(0);
    expect(second.notified).toHaveLength(0);
  });

  it("formats a short notification summary from hard shortages", () => {
    expect(
      formatDealAlertNotificationSummary([makeMatch("Alpha", HARD_SOURCE)])
        .description
    ).toBe("Card: Alpha for sale!");

    expect(
      formatDealAlertNotificationSummary([
        makeMatch("Alpha", HARD_SOURCE),
        makeMatch("Beta", HARD_SOURCE),
        makeMatch("Gamma", HARD_SOURCE),
      ]).description
    ).toBe("Cards: Alpha, Beta and Gamma for sale!");

    expect(
      formatDealAlertNotificationSummary([
        makeMatch("Alpha", HARD_SOURCE),
        makeMatch("Beta", HARD_SOURCE),
        makeMatch("Gamma", HARD_SOURCE),
        makeMatch("Delta", HARD_SOURCE),
      ]).description
    ).toBe("Cards: Alpha, Beta and Gamma and more for sale!");

    expect(
      formatDealAlertNotificationSummary([
        makeMatch("Alpha", { kind: "personal-want", desiredQuantity: 1 }),
      ]).description
    ).toBe("New cards from your wantlist are for sale.");
  });

  it("truncates the notification title and description to Root limits", () => {
    const veryLong = "A".repeat(80);
    const summary = formatDealAlertNotificationSummary([
      makeMatch(veryLong, HARD_SOURCE),
      makeMatch(`${veryLong}B`, HARD_SOURCE),
      makeMatch(`${veryLong}C`, HARD_SOURCE),
      makeMatch(`${veryLong}D`, HARD_SOURCE),
    ]);

    expect(summary.title.length).toBeLessThanOrEqual(50);
    expect(summary.description.length).toBeLessThanOrEqual(150);
  });
});

describe("deal alert messages migration", () => {
  it("back-fills legacy discord rows as the discord-dm destination", async () => {
    const client = createClient({ url: ":memory:" });
    await client.execute(
      "CREATE TABLE `deal_alert_messages` (`discord_user_id` text PRIMARY KEY NOT NULL, `channel_id` text NOT NULL, `message_id` text NOT NULL, `last_listing_keys` text DEFAULT '[]' NOT NULL, `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL);"
    );
    await client.execute(
      "INSERT INTO `deal_alert_messages` (`discord_user_id`, `channel_id`, `message_id`, `last_listing_keys`) VALUES ('legacy_user', 'dm-1', 'msg-1', '[\"k\"]');"
    );

    await runMigrations(client);

    const result = await client.execute(
      "SELECT `destination`, `recipient_id`, `channel_id`, `message_id`, `last_listing_keys` FROM `deal_alert_messages`;"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].destination).toBe("discord-dm");
    expect(result.rows[0].recipient_id).toBe("legacy_user");
    expect(result.rows[0].message_id).toBe("msg-1");
  });
});
