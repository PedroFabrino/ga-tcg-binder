import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../db/test-utils";
import {
  users,
  collectorIdentities,
  cards,
  decks,
  deckCards,
  marketStores,
  marketCards,
} from "../../db/schema";
import { upsertPersonalWant } from "../../db/repositories/personal-wants-repository";
import {
  matchDealAlerts,
  formatDealAlertMessage,
  formatDealAlertChunks,
  dispatchDealAlerts,
  parseMessageIds,
  type DealAlertMatch,
  type DealAlertMessageRef,
  type DealAlertTransport,
} from "../discord-deal-notifier";
import { MESSAGE_MAX_LENGTH } from "../../lib/market-vocabulary";
import type { MarketCard } from "../../db/schema";

function createFakeTransport() {
  const sent: Array<{
    discordUserId: string;
    content: string;
    ref: DealAlertMessageRef;
  }> = [];
  const deleted: DealAlertMessageRef[] = [];
  let nextId = 0;

  const transport: DealAlertTransport = {
    async send(discordUserId, content) {
      nextId += 1;
      const ref = {
        channelId: `dm-${discordUserId}`,
        messageId: `msg-${nextId}`,
      };
      sent.push({ discordUserId, content, ref });
      return ref;
    },
    async delete(ref) {
      deleted.push(ref);
    },
  };

  return { transport, sent, deleted };
}

describe("Discord Deal Alerts Matcher and Notifier", () => {
  let db: any;
  const testCollectorId = "user_alert_1";
  const discordUserId = "discord_alert_user_1";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    await db.insert(users).values({
      id: testCollectorId,
      name: "Kay",
      email: "kay@camelot.local",
      friendCode: "GA-SIRKAY",
      locale: "en",
    });

    await db.insert(cards).values([
      {
        slug: "creative-shock",
        name: "Creative Shock",
        element: "water",
        class: "mage",
        type: "action",
      },
      {
        slug: "fireball",
        name: "Fireball",
        element: "fire",
        class: "mage",
        type: "spell",
      },
    ]);

    await db.insert(collectorIdentities).values({
      id: "ident_kay",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: discordUserId,
      wantlistNotificationsEnabled: true,
      linkedAt: new Date(),
    });

    await upsertPersonalWant(
      {
        collectorId: testCollectorId,
        cardSlug: "creative-shock",
        desiredQuantity: 1,
        targetMaxPrice: 60.0,
        foil: true,
      },
      db
    );

    await db.insert(decks).values({
      id: "deck_kay",
      userId: testCollectorId,
      name: "Burn Deck",
      format: "standard",
    });

    await db.insert(deckCards).values({
      id: "dc_kay_1",
      deckId: "deck_kay",
      cardSlug: "fireball",
      zone: "main",
      quantity: 4,
    });

    await db.insert(marketStores).values({
      id: "store_myp",
      platform: "myp",
      name: "MyP",
      baseUrl: "https://mypcards.com",
    });
  });

  it("matches listings against personal wants respecting max price and foil", async () => {
    const listingFoilUnderMax: MarketCard = {
      id: "mc_1",
      storeId: "store_myp",
      cardSlug: "creative-shock",
      editionId: null,
      rawName: "Creative Shock",
      cardName: "Creative Shock",
      setPrefix: "DOA",
      quantity: 1,
      price: "R$ 55,00",
      priceNumeric: 55.0,
      tcgPrice: null,
      tcgPriceNumeric: null,
      quality: "NM",
      isFoil: true,
      itemId: "item_1",
      productUrl: "https://myp.local/shock",
      vendorName: "Camelot Cards",
      vendorUrl: null,
      firstSeenAt: new Date(),
      lastStockedAt: null,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    const listingOverMax: MarketCard = {
      ...listingFoilUnderMax,
      id: "mc_2",
      priceNumeric: 75.0,
    };

    const listingNonFoil: MarketCard = {
      ...listingFoilUnderMax,
      id: "mc_3",
      isFoil: false,
    };

    const matches = await matchDealAlerts([listingFoilUnderMax, listingOverMax, listingNonFoil], db);

    expect(matches).toHaveLength(1);
    expect(matches[0].collectorId).toBe(testCollectorId);
    expect(matches[0].recipientId).toBe(discordUserId);
    expect(matches[0].source.kind).toBe("personal-want");
  });

  it("matches listings against deck shortages", async () => {
    const fireballListing: MarketCard = {
      id: "mc_fb",
      storeId: "store_myp",
      cardSlug: "fireball",
      editionId: null,
      rawName: "Fireball",
      cardName: "Fireball",
      setPrefix: "DOA",
      quantity: 2,
      price: "R$ 10,00",
      priceNumeric: 10.0,
      tcgPrice: null,
      tcgPriceNumeric: null,
      quality: "NM",
      isFoil: false,
      itemId: "item_fb",
      productUrl: "https://myp.local/fireball",
      vendorName: "Liga Magic Store",
      vendorUrl: null,
      firstSeenAt: new Date(),
      lastStockedAt: null,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    const matches = await matchDealAlerts([fireballListing], db);

    expect(matches).toHaveLength(1);
    expect(matches[0].source).toMatchObject({ kind: "hard", deckName: "Burn Deck" });
  });

  it("dispatches a single plain-text DM with the wantlist section", async () => {
    await db.insert(marketCards).values({
      id: "mc_dispatch_1",
      storeId: "store_myp",
      cardSlug: "creative-shock",
      rawName: "Creative Shock",
      cardName: "Creative Shock",
      setPrefix: "DOA",
      quantity: 1,
      price: "R$ 55,00",
      priceNumeric: 55.0,
      isFoil: true,
      itemId: "item_dispatch_1",
      productUrl: "https://myp.local/shock",
      vendorName: "Camelot Cards",
    });

    const fake = createFakeTransport();
    const result = await dispatchDealAlerts(db, fake.transport);

    expect(result.matched).toBe(1);
    expect(result.sent).toBe(1);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].discordUserId).toBe(discordUserId);
    expect(fake.sent[0].content).toContain("**Wantlist**");
    expect(fake.sent[0].content).toContain(
      "🎯 [Creative Shock](<https://myp.local/shock>) - DOA - R$ 55,00"
    );
    expect(fake.deleted).toHaveLength(0);
  });

  it("keeps a single rolling message: deletes the previous one when new listings appear and does nothing otherwise", async () => {
    await db.insert(marketCards).values({
      id: "mc_roll_shock",
      storeId: "store_myp",
      cardSlug: "creative-shock",
      rawName: "Creative Shock",
      cardName: "Creative Shock",
      setPrefix: "DOA",
      quantity: 1,
      price: "R$ 55,00",
      priceNumeric: 55.0,
      isFoil: true,
      itemId: "item_roll_shock",
    });

    const fake = createFakeTransport();

    // First dispatch: sends the initial snapshot.
    const first = await dispatchDealAlerts(db, fake.transport);
    expect(first.sent).toBe(1);
    expect(fake.sent).toHaveLength(1);
    expect(fake.deleted).toHaveLength(0);

    // Second dispatch with no new listings: no-op.
    const unchanged = await dispatchDealAlerts(db, fake.transport);
    expect(unchanged.sent).toBe(0);
    expect(fake.sent).toHaveLength(1);
    expect(fake.deleted).toHaveLength(0);

    // A new matching listing appears: the old message is deleted and a fresh
    // snapshot (covering both sections) is sent.
    await db.insert(marketCards).values({
      id: "mc_roll_fireball",
      storeId: "store_myp",
      cardSlug: "fireball",
      rawName: "Fireball",
      cardName: "Fireball",
      setPrefix: "DOA",
      quantity: 1,
      price: "R$ 10,00",
      priceNumeric: 10.0,
      isFoil: false,
      itemId: "item_roll_fireball",
    });

    const updated = await dispatchDealAlerts(db, fake.transport);
    expect(updated.sent).toBe(1);
    expect(fake.sent).toHaveLength(2);
    expect(fake.deleted).toEqual([fake.sent[0].ref]);
    expect(fake.sent[1].content).toContain("**Burn Deck**");
    expect(fake.sent[1].content).toContain("🔴 Fireball - DOA - R$ 10,00");
    expect(fake.sent[1].content).toContain("**Wantlist**");

    // When card is added to binder (e.g. personal want fulfilled/removed),
    // next run removes it from the DM!
    const { removePersonalWant } = await import("../../db/repositories/personal-wants-repository");
    await removePersonalWant(testCollectorId, "creative-shock", undefined, db);

    const afterCardAcquired = await dispatchDealAlerts(db, fake.transport);
    expect(afterCardAcquired.sent).toBe(1);
    expect(fake.sent).toHaveLength(3);
    expect(fake.deleted).toEqual([fake.sent[0].ref, fake.sent[1].ref]);
    // The Wantlist section with Creative Shock is gone!
    expect(fake.sent[2].content).not.toContain("Creative Shock");
    expect(fake.sent[2].content).toContain("**Burn Deck**");

    // If remaining deck shortages are resolved (0 matches), old message is deleted
    await db.delete(deckCards).where(eq(deckCards.cardSlug, "fireball"));
    const afterAllAcquired = await dispatchDealAlerts(db, fake.transport);
    expect(afterAllAcquired.sent).toBe(0);
    expect(afterAllAcquired.matched).toBe(0);
    // Previous message was deleted
    expect(fake.deleted).toEqual([fake.sent[0].ref, fake.sent[1].ref, fake.sent[2].ref]);

    // Force refresh updates message even if matches are unchanged
    await db.insert(deckCards).values({
      id: "dc_readd",
      deckId: "deck_kay",
      cardSlug: "fireball",
      quantity: 1,
      zone: "main",
    });
    await dispatchDealAlerts(db, fake.transport); // initial post
    const forceRefreshResult = await dispatchDealAlerts(
      db,
      fake.transport,
      new Date(),
      { forceRefresh: true }
    );
    expect(forceRefreshResult.sent).toBe(1);
  });

  it("formats one rolling message with per-deck and wantlist sections plus a timestamp", () => {
    const creativeShockListing: MarketCard = {
      id: "mc_fmt_want",
      storeId: "store_loot",
      cardSlug: "creative-shock",
      editionId: null,
      rawName: "Creative Shock",
      cardName: "Creative Shock",
      setPrefix: "DOA",
      quantity: 1,
      price: "R$ 50,00",
      priceNumeric: 50.0,
      tcgPrice: null,
      tcgPriceNumeric: null,
      quality: "NM",
      isFoil: true,
      itemId: "grandarchive_dtr1e_064",
      productUrl: "https://loot.local/shock",
      vendorName: "Lootcards",
      vendorUrl: null,
      firstSeenAt: new Date(),
      lastStockedAt: null,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    const fireballListing: MarketCard = {
      id: "mc_fmt_fb",
      storeId: "store_liga",
      cardSlug: "fireball",
      editionId: null,
      rawName: "Fireball",
      cardName: "Fireball",
      setPrefix: "DOA",
      quantity: 1,
      price: "R$ 10,00",
      priceNumeric: 10.0,
      tcgPrice: null,
      tcgPriceNumeric: null,
      quality: "NM",
      isFoil: false,
      itemId: "item_fb",
      productUrl: "https://liga.local/fireball",
      vendorName: "Liga Magic Store",
      vendorUrl: null,
      firstSeenAt: new Date(),
      lastStockedAt: null,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    const matches: DealAlertMatch[] = [
      {
        collectorId: testCollectorId,
        recipientId: discordUserId,
        listing: creativeShockListing,
        source: { kind: "personal-want", desiredQuantity: 1 },
      },
      {
        collectorId: testCollectorId,
        recipientId: discordUserId,
        listing: fireballListing,
        source: { kind: "hard", deckId: "deck_kay", deckName: "Burn Deck", missingQuantity: 4 },
      },
    ];

    const content = formatDealAlertMessage(
      matches,
      new Date("2026-10-22T20:15:00Z")
    );

    expect(content).toBe(
      [
        "🕒 Last update: 22/10/2026 17:15",
        "",
        "**Burn Deck**",
        "🔴 [Fireball](<https://liga.local/fireball>) - DOA - R$ 10,00",
        "",
        "**Wantlist**",
        "🎯 [Creative Shock](<https://loot.local/shock>) - DOA 064 - R$ 50,00",
      ].join("\n")
    );
  });

  describe("parseMessageIds", () => {
    it("handles single IDs, comma-separated IDs, JSON arrays, and edge cases", () => {
      expect(parseMessageIds("123456789")).toEqual(["123456789"]);
      expect(parseMessageIds("123,456, 789")).toEqual(["123", "456", "789"]);
      expect(parseMessageIds('["msg1", "msg2"]')).toEqual(["msg1", "msg2"]);
      expect(parseMessageIds("")).toEqual([]);
      expect(parseMessageIds(null)).toEqual([]);
      expect(parseMessageIds(undefined)).toEqual([]);
    });
  });

  it("splits large deal alerts into chunks <= MESSAGE_MAX_LENGTH", () => {
    const matches: DealAlertMatch[] = [];
    for (let i = 1; i <= 50; i++) {
      matches.push({
        collectorId: testCollectorId,
        recipientId: discordUserId,
        listing: {
          id: `mc_bulk_${i}`,
          storeId: "store_myp",
          cardSlug: "creative-shock",
          editionId: null,
          rawName: `Creative Shock ${i}`,
          cardName: `Creative Shock Edition With A Rather Long Name ${i}`,
          setPrefix: "DOA",
          quantity: 1,
          price: `R$ ${i},00`,
          priceNumeric: i,
          tcgPrice: null,
          tcgPriceNumeric: null,
          quality: "NM",
          isFoil: true,
          itemId: `item_${i}`,
          productUrl: `https://mypcards.com/grandarchive/produto/${i}/creative-shock-edition-with-a-rather-long-name-${i}`,
          vendorName: "Camelot Cards",
          vendorUrl: null,
          firstSeenAt: new Date(),
          lastStockedAt: null,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
        source: { kind: "personal-want", desiredQuantity: 1 },
      });
    }

    const full = formatDealAlertMessage(matches);
    expect(full.length).toBeGreaterThan(MESSAGE_MAX_LENGTH);

    const chunks = formatDealAlertChunks(matches);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
    }
  });

  it("dispatches multi-chunk messages and deletes all old chunks on update", async () => {
    // Insert 50 market cards to trigger multi-chunk delivery
    for (let i = 1; i <= 50; i++) {
      await db.insert(marketCards).values({
        id: `mc_large_${i}`,
        storeId: "store_myp",
        cardSlug: "creative-shock",
        rawName: `Creative Shock ${i}`,
        cardName: `Creative Shock Extended Card Name Edition ${i}`,
        setPrefix: "DOA",
        quantity: 1,
        price: `R$ 50,00`,
        priceNumeric: 50.0,
        isFoil: true,
        itemId: `item_large_${i}`,
        productUrl: `https://mypcards.com/grandarchive/produto/${i}/creative-shock-extended-card-name-edition-${i}`,
      });
    }

    const fake = createFakeTransport();
    const firstDispatch = await dispatchDealAlerts(db, fake.transport);

    expect(firstDispatch.sent).toBe(1);
    expect(fake.sent.length).toBeGreaterThan(1);
    const firstSentCount = fake.sent.length;
    const firstSentRefs = [...fake.sent.map((s) => s.ref)];

    // Adding another new card triggers rolling update
    await db.insert(marketCards).values({
      id: "mc_extra",
      storeId: "store_myp",
      cardSlug: "creative-shock",
      rawName: "Creative Shock Extra",
      cardName: "Creative Shock Extra",
      setPrefix: "DOA",
      quantity: 1,
      price: "R$ 50,00",
      priceNumeric: 50.0,
      isFoil: true,
      itemId: "item_extra",
    });

    const secondDispatch = await dispatchDealAlerts(db, fake.transport);
    expect(secondDispatch.sent).toBe(1);
    // All previous chunks must have been deleted
    expect(fake.deleted).toEqual(firstSentRefs);
    expect(fake.sent.length).toBeGreaterThan(firstSentCount);
  });

  it("rolls back sent chunks and preserves stored message if a chunk fails", async () => {
    for (let i = 1; i <= 50; i++) {
      await db.insert(marketCards).values({
        id: `mc_fail_${i}`,
        storeId: "store_myp",
        cardSlug: "creative-shock",
        rawName: `Creative Shock ${i}`,
        cardName: `Creative Shock Extended Card Name Edition ${i}`,
        setPrefix: "DOA",
        quantity: 1,
        price: `R$ 50,00`,
        priceNumeric: 50.0,
        isFoil: true,
        itemId: `item_fail_${i}`,
        productUrl: `https://mypcards.com/grandarchive/produto/${i}/creative-shock-extended-card-name-edition-${i}`,
      });
    }

    let attempt = 0;
    const sent: DealAlertMessageRef[] = [];
    const deleted: DealAlertMessageRef[] = [];
    const failingTransport: DealAlertTransport = {
      async send(userId, content) {
        attempt++;
        if (attempt === 2) {
          // Second chunk fails (e.g. Discord 400 or network error)
          return null;
        }
        const ref = { channelId: `dm-${userId}`, messageId: `msg-${attempt}` };
        sent.push(ref);
        return ref;
      },
      async delete(ref) {
        deleted.push(ref);
      },
    };

    const res = await dispatchDealAlerts(db, failingTransport);
    expect(res.sent).toBe(0);
    // First chunk that was sent should be cleaned up via delete
    expect(deleted).toEqual([sent[0]]);
  });
});
