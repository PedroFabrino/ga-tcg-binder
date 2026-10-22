import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, collectorIdentities, decks, deckCards, cards, cardEditions, collectionItems } from "../../db/schema";
import { handleDiscordMessageComponent } from "../discord-interactions/components";
import type { DiscordInteractionPayload } from "../discord-interactions/types";

describe("Discord Select Menu Interaction Service", () => {
  let db: any;
  const testCollectorId = "user_select_1";
  const discordUserId = "discord_select_user_1";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    await db.insert(users).values({
      id: testCollectorId,
      name: "Tristan",
      email: "tristan@camelot.local",
      friendCode: "GA-TRISTAN",
      locale: "en",
    });

    await db.insert(collectorIdentities).values({
      id: "ident_tristan",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: discordUserId,
      linkedAt: new Date(),
    });

    await db.insert(cards).values([
      {
        slug: "creative-shock",
        name: "Creative Shock",
        element: "water",
        class: "mage",
        type: "action",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed_shock_tristan",
        cardSlug: "creative-shock",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "042",
        rarity: 3,
        imageUrl: "https://images.ga.local/doa-042.png",
      },
    ]);

    await db.insert(decks).values([
      {
        id: "deck_tristan_1",
        userId: testCollectorId,
        name: "Tristan Bow",
        champion: "Diana",
        format: "standard",
      },
      {
        id: "deck_tristan_2",
        userId: testCollectorId,
        name: "Arthur Aggro",
        champion: "Arthur",
        format: "standard",
      },
    ]);

    await db.insert(deckCards).values([
      {
        id: "dc_1",
        deckId: "deck_tristan_1",
        cardSlug: "creative-shock",
        zone: "main",
        quantity: 2,
      },
    ]);
  });

  it("handles select_deck_details and renders deck details in-place with type: 7", async () => {
    const payload: DiscordInteractionPayload = {
      type: 3, // MESSAGE_COMPONENT
      id: "int_comp_1",
      token: "tok",
      data: {
        custom_id: "select_deck_details",
        values: ["deck_tristan_1"],
      },
      user: { id: discordUserId, username: "Tristan" },
    };

    const res = await handleDiscordMessageComponent(payload, db);
    expect(res.type).toBe(7); // UPDATE_MESSAGE
    expect(res.data?.embeds?.[0].title).toContain("Tristan Bow Details");
    expect(res.data?.components).toBeDefined();
    expect(res.data?.components?.[0].components?.[0].custom_id).toBe("select_deck_details");
  });

  it("handles '« Back to All Decks' and restores full decks overview", async () => {
    const payload: DiscordInteractionPayload = {
      type: 3,
      id: "int_comp_back",
      token: "tok",
      data: {
        custom_id: "select_deck_details",
        values: ["__overview__"],
      },
      user: { id: discordUserId, username: "Tristan" },
    };

    const res = await handleDiscordMessageComponent(payload, db);
    expect(res.type).toBe(7);
    expect(res.data?.embeds?.[0].title).toContain("Tristan's Decks (2)");
  });

  it("handles select_deck_shortages and renders itemized shortages in-place", async () => {
    const payload: DiscordInteractionPayload = {
      type: 3,
      id: "int_comp_short",
      token: "tok",
      data: {
        custom_id: "select_deck_shortages",
        values: ["deck_tristan_1"],
      },
      user: { id: discordUserId, username: "Tristan" },
    };

    const res = await handleDiscordMessageComponent(payload, db);
    expect(res.type).toBe(7);
    expect(res.data?.embeds?.[0].title).toContain("Shortages for Tristan Bow");
    expect(res.data?.embeds?.[0].fields?.length).toBeGreaterThan(0);
    expect(res.data?.embeds?.[0].fields?.[0].name).toContain("Hard Shortages");
  });
});
