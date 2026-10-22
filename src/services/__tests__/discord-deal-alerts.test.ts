import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, collectorIdentities, cards, decks, deckCards } from "../../db/schema";
import { upsertPersonalWant } from "../../db/repositories/personal-wants-repository";
import {
  matchDealAlerts,
  formatDealAlertEmbed,
  clearAlertsCache,
  isAlertRecentlySent,
  getDedupeKey,
} from "../discord-deal-notifier";
import type { MarketCard } from "../../db/schema";

describe("Discord Deal Alerts Matcher and Notifier", () => {
  let db: any;
  const testCollectorId = "user_alert_1";
  const discordUserId = "discord_alert_user_1";

  beforeEach(async () => {
    clearAlertsCache();
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
    expect(matches[0].discordUserId).toBe(discordUserId);
    expect(matches[0].reason).toContain("Personal Want");
  });

  it("matches listings against deck shortages", async () => {
    const fireballListing: MarketCard = {
      id: "mc_fb",
      storeId: "store_liga",
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
      productUrl: "https://liga.local/fireball",
      vendorName: "Liga Magic Store",
      vendorUrl: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    const matches = await matchDealAlerts([fireballListing], db);

    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toContain("Hard Shortage for Burn Deck");
  });

  it("dedupes alerts to prevent spam within 24 hours", async () => {
    const listing: MarketCard = {
      id: "mc_fb_2",
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
      itemId: "item_fb_2",
      productUrl: "https://liga.local/fireball",
      vendorName: "Liga Magic Store",
      vendorUrl: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    const firstRun = await matchDealAlerts([listing], db);
    expect(firstRun).toHaveLength(1);

    // Second run should dedupe and return 0
    const secondRun = await matchDealAlerts([listing], db);
    expect(secondRun).toHaveLength(0);
  });

  it("formats deal alert embed correctly", () => {
    const match = {
      collectorId: testCollectorId,
      discordUserId,
      listing: {
        id: "mc_embed",
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
        itemId: "item_embed",
        productUrl: "https://loot.local/shock",
        vendorName: "Lootcards",
        vendorUrl: null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
      reason: "🎯 Personal Want (needs 1)",
    };

    const embed = formatDealAlertEmbed(match);
    expect(embed.title).toContain("Creative Shock");
    expect(embed.fields?.find((f) => f.name === "Price")?.value).toBe("**R$ 50,00**");
    expect(embed.fields?.find((f) => f.name === "Store / Seller")?.value).toBe("Lootcards");
    expect(embed.fields?.find((f) => f.name === "Direct Store Link")?.value).toContain("https://loot.local/shock");
  });
});
