import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, cards, decks, collectorIdentities } from "../../db/schema";
import { upsertPersonalWant } from "../../db/repositories/personal-wants-repository";
import { handleDiscordAutocomplete } from "../discord-interactions/autocomplete";
import type { DiscordInteractionPayload } from "../discord-interactions/types";

describe("Discord Autocomplete Service", () => {
  let db: any;
  const testCollectorId = "user_auto_1";
  const discordUserId = "discord_auto_user_1";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    await db.insert(users).values({
      id: testCollectorId,
      name: "Percival",
      email: "percival@camelot.local",
      friendCode: "GA-PERCI",
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

    await db.insert(decks).values({
      id: "deck_perci_1",
      userId: testCollectorId,
      name: "Water Control",
      champion: "Merlin",
      format: "standard",
    });
  });

  it("returns unlinked guidance when unlinked user autocompletes decks", async () => {
    const payload: DiscordInteractionPayload = {
      type: 4,
      id: "int_auto_unlinked",
      token: "tok",
      data: {
        name: "shortages",
        options: [{ name: "deck", type: 3, value: "Wat", focused: true }],
      },
      user: { id: "unknown_user", username: "Unknown" },
    };

    const start = Date.now();
    const res = await handleDiscordAutocomplete(payload, db);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50);
    expect(res.type).toBe(8);
    expect(res.data?.choices?.[0].name).toContain("Link your GA Binder account");
    expect(res.data?.choices?.[0].value).toBe("");
  });

  it("autocompletes deck choices for linked user", async () => {
    await db.insert(collectorIdentities).values({
      id: "ident_perci",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: discordUserId,
      linkedAt: new Date(),
    });

    const payload: DiscordInteractionPayload = {
      type: 4,
      id: "int_auto_deck",
      token: "tok",
      data: {
        name: "shortages",
        options: [{ name: "deck", type: 3, value: "Water", focused: true }],
      },
      user: { id: discordUserId, username: "Percival" },
    };

    const res = await handleDiscordAutocomplete(payload, db);
    expect(res.type).toBe(8);
    expect(res.data?.choices).toHaveLength(1);
    expect(res.data?.choices?.[0].name).toContain("Water Control (Merlin - standard)");
    expect(res.data?.choices?.[0].value).toBe("Water Control");
  });

  it("autocompletes catalog cards for /wantlist add", async () => {
    const payload: DiscordInteractionPayload = {
      type: 4,
      id: "int_auto_card",
      token: "tok",
      data: {
        name: "wantlist",
        options: [
          {
            name: "add",
            type: 1,
            options: [{ name: "card", type: 3, value: "creat", focused: true }],
          },
        ],
      },
      user: { id: discordUserId, username: "Percival" },
    };

    const res = await handleDiscordAutocomplete(payload, db);
    expect(res.type).toBe(8);
    expect(res.data?.choices).toHaveLength(1);
    expect(res.data?.choices?.[0].name).toBe("Creative Shock (water action)");
    expect(res.data?.choices?.[0].value).toBe("creative-shock");
  });

  it("autocompletes personal wants for /wantlist remove", async () => {
    await db.insert(collectorIdentities).values({
      id: "ident_perci",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: discordUserId,
      linkedAt: new Date(),
    });

    await upsertPersonalWant(
      {
        collectorId: testCollectorId,
        cardSlug: "creative-shock",
        desiredQuantity: 3,
      },
      db
    );

    const payload: DiscordInteractionPayload = {
      type: 4,
      id: "int_auto_rem",
      token: "tok",
      data: {
        name: "wantlist",
        options: [
          {
            name: "remove",
            type: 1,
            options: [{ name: "card", type: 3, value: "Shock", focused: true }],
          },
        ],
      },
      user: { id: discordUserId, username: "Percival" },
    };

    const res = await handleDiscordAutocomplete(payload, db);
    expect(res.type).toBe(8);
    expect(res.data?.choices).toHaveLength(1);
    expect(res.data?.choices?.[0].name).toBe("Creative Shock (Wanted: 3)");
    expect(res.data?.choices?.[0].value).toBe("creative-shock");
  });
});
