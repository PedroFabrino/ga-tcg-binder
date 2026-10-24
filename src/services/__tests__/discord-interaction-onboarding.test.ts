import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, collectorIdentities } from "../../db/schema";
import {
  handleDiscordInteraction,
  type DiscordInteractionPayload,
} from "../discord-interaction";
import { eq } from "drizzle-orm";

describe("Discord Interaction Onboarding & Self-Registration", () => {
  let db: any;
  const newDiscordUserId = "discord_newbie_123456";
  const newDiscordUsername = "NewCollector#4321";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
  });

  it("presents onboarding buttons when an unlinked user runs a command", async () => {
    const payload: DiscordInteractionPayload = {
      type: 2,
      id: "int-decks-unlinked",
      token: "tok-1",
      data: { name: "decks" },
      user: {
        id: newDiscordUserId,
        username: newDiscordUsername,
      },
    };

    const res = await handleDiscordInteraction(payload, db);
    expect(res.type).toBe(4);
    expect(res.data?.flags).toBe(64);
    expect(res.data?.embeds?.[0].title).toBe("Grand Archive Binder Account Not Linked");
    expect(res.data?.embeds?.[0].description).toContain("Create Account with Discord");

    // Check onboarding buttons
    const actionRow = res.data?.components?.[0];
    expect(actionRow?.type).toBe(1);
    expect(actionRow?.components).toHaveLength(2);

    const [createBtn, linkBtn] = actionRow!.components as any[];
    expect(createBtn.custom_id).toBe("register_discord_account");
    expect(createBtn.label).toBe("Create Account with Discord");
    expect(createBtn.style).toBe(3); // Success / Green

    expect(linkBtn.custom_id).toBe("help_link_account");
    expect(linkBtn.label).toBe("Link Existing Account");
  });

  it("creates an account via the 'Create Account with Discord' button", async () => {
    const buttonPayload: DiscordInteractionPayload = {
      type: 3, // MESSAGE_COMPONENT
      id: "btn-register",
      token: "tok-btn",
      data: {
        custom_id: "register_discord_account",
        component_type: 2,
      },
      user: {
        id: newDiscordUserId,
        username: newDiscordUsername,
      },
    };

    const res = await handleDiscordInteraction(buttonPayload, db);
    expect(res.type).toBe(7); // UPDATE_MESSAGE
    expect(res.data?.flags).toBe(64);
    expect(res.data?.embeds?.[0].title).toBe("🎉 Account Created Successfully!");
    expect(res.data?.embeds?.[0].description).toContain(newDiscordUsername);
    expect(res.data?.embeds?.[0].description).toContain("GA-");
    expect(res.data?.components).toEqual([]);

    // Verify database state
    const [identity] = await db
      .select()
      .from(collectorIdentities)
      .where(eq(collectorIdentities.providerUserId, newDiscordUserId));
    expect(identity).toBeDefined();
    expect(identity.provider).toBe("discord");

    const [user] = await db.select().from(users).where(eq(users.id, identity.collectorId));
    expect(user).toBeDefined();
    expect(user.name).toBe(newDiscordUsername);
    expect(user.friendCode).toMatch(/^GA-[2-9A-HJ-NP-Z]{6}$/);

    // Follow-up: now running /decks succeeds directly as linked user
    const decksPayload: DiscordInteractionPayload = {
      type: 2,
      id: "int-decks-now-linked",
      token: "tok-2",
      data: { name: "decks" },
      user: {
        id: newDiscordUserId,
        username: newDiscordUsername,
      },
    };

    const decksRes = await handleDiscordInteraction(decksPayload, db);
    expect(decksRes.type).toBe(4);
    expect(decksRes.data?.embeds?.[0].title).toBe(`${newDiscordUsername}'s Decks`);
  });

  it("handles duplicate button clicks gracefully with already linked notification", async () => {
    // First click: registers
    await handleDiscordInteraction(
      {
        type: 3,
        id: "btn-reg-1",
        token: "tok-btn-1",
        data: { custom_id: "register_discord_account", component_type: 2 },
        user: { id: newDiscordUserId, username: newDiscordUsername },
      },
      db
    );

    // Second click: already linked
    const secondRes = await handleDiscordInteraction(
      {
        type: 3,
        id: "btn-reg-2",
        token: "tok-btn-2",
        data: { custom_id: "register_discord_account", component_type: 2 },
        user: { id: newDiscordUserId, username: newDiscordUsername },
      },
      db
    );

    expect(secondRes.type).toBe(7);
    expect(secondRes.data?.embeds?.[0].title).toBe("Account Already Linked");
    expect(secondRes.data?.embeds?.[0].description).toContain(newDiscordUsername);
  });

  it("handles 'Link Existing Account' button guidance", async () => {
    const helpPayload: DiscordInteractionPayload = {
      type: 3,
      id: "btn-help-link",
      token: "tok-help",
      data: { custom_id: "help_link_account", component_type: 2 },
      user: { id: newDiscordUserId, username: newDiscordUsername },
    };

    const res = await handleDiscordInteraction(helpPayload, db);
    expect(res.type).toBe(7);
    expect(res.data?.embeds?.[0].title).toBe("Linking Your Existing Web Account");
    expect(res.data?.embeds?.[0].description).toContain("/link <code>");

    // Still retains Create Account button
    const actionRow = res.data?.components?.[0];
    expect(actionRow?.components?.[0].custom_id).toBe("register_discord_account");
  });

  it("supports direct /register slash command", async () => {
    const regPayload: DiscordInteractionPayload = {
      type: 2,
      id: "cmd-register",
      token: "tok-cmd",
      data: { name: "register" },
      user: { id: "discord_direct_cmd_user", username: "DirectCmdUser" },
    };

    const res = await handleDiscordInteraction(regPayload, db);
    expect(res.type).toBe(4);
    expect(res.data?.embeds?.[0].title).toBe("🎉 Account Created Successfully!");
    expect(res.data?.embeds?.[0].description).toContain("DirectCmdUser");

    // Running /register a second time informs user they are already linked
    const res2 = await handleDiscordInteraction(regPayload, db);
    expect(res2.type).toBe(4);
    expect(res2.data?.embeds?.[0].title).toBe("Account Already Linked");
  });
});
