import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, collectorIdentities, collectorPairingTokens } from "../../db/schema";
import {
  handleDiscordInteraction,
  type DiscordInteractionPayload,
} from "../discord-interaction";

describe("Discord Interaction Service (handleDiscordInteraction)", () => {
  let db: any;
  const testCollectorId = "user_gawain_456";
  const discordUserId = "998877665544";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    // Seed test user
    await db.insert(users).values({
      id: testCollectorId,
      name: "Sir Gawain",
      email: "gawain@camelot.local",
      friendCode: "GA-GAWAIN",
      locale: "en",
    });
  });

  it("handles /link command with valid pairing code", async () => {
    // Seed pairing token
    await db.insert(collectorPairingTokens).values({
      id: "tok-id-1",
      collectorId: testCollectorId,
      token: "PAIR42",
      expiresAt: new Date(Date.now() + 600000),
    });

    const payload: DiscordInteractionPayload = {
      type: 2,
      id: "int-link",
      token: "tok-int",
      data: {
        name: "link",
        options: [{ name: "code", type: 3, value: "PAIR42" }],
      },
      user: {
        id: discordUserId,
        username: "Gawain#5678",
      },
    };

    const res = await handleDiscordInteraction(payload, db);
    expect(res.type).toBe(4);
    expect(res.data?.flags).toBe(64);
    expect(res.data?.embeds?.[0].title).toBe("Account Linked Successfully!");
    expect(res.data?.embeds?.[0].description).toContain("Sir Gawain");
  });

  it("returns helpful unlinked guidance when user runs /decks without linking", async () => {
    const payload: DiscordInteractionPayload = {
      type: 2,
      id: "int-decks",
      token: "tok-int",
      data: {
        name: "decks",
      },
      user: {
        id: "unlinked-user-999",
        username: "UnlinkedUser",
      },
    };

    const res = await handleDiscordInteraction(payload, db);
    expect(res.type).toBe(4);
    expect(res.data?.flags).toBe(64);
    expect(res.data?.embeds?.[0].title).toBe("Grand Archive Binder Account Not Linked");
    expect(res.data?.embeds?.[0].description).toContain("/link <code>");
  });

  it("returns empty decks response when user has no decks", async () => {
    // Link user
    await db.insert(collectorIdentities).values({
      id: "ident-gawain",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: discordUserId,
      providerUsername: "Gawain#5678",
      linkedAt: new Date(),
    });

    const payload: DiscordInteractionPayload = {
      type: 2,
      id: "int-decks-linked",
      token: "tok-int",
      data: {
        name: "decks",
      },
      user: {
        id: discordUserId,
        username: "Gawain#5678",
      },
    };

    const res = await handleDiscordInteraction(payload, db);
    expect(res.type).toBe(4);
    expect(res.data?.flags).toBe(64);
    expect(res.data?.embeds?.[0].title).toContain("Sir Gawain");
    expect(res.data?.embeds?.[0].description).toContain("don't have any decks saved");
  });
});
