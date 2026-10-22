import { describe, expect, it, beforeEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import {
  users,
  collectorIdentities,
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
} from "../../db/schema";
import {
  handleDiscordInteraction,
  type DiscordInteractionPayload,
} from "../discord-interaction";
import * as dealNotifier from "../discord-deal-notifier";

describe("Discord Interactive Selection, Wants & Omnidex Integration", () => {
  let db: any;
  const testCollectorId = "user_lancelot";
  const discordUserId = "discord_lance_1";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    await db.insert(users).values({
      id: testCollectorId,
      name: "Sir Lancelot",
      email: "lancelot@camelot.local",
      friendCode: "GA-LANCE",
      locale: "en",
    });

    await db.insert(collectorIdentities).values({
      id: "ident_lancelot",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: discordUserId,
      wantlistNotificationsEnabled: false,
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
      {
        slug: "fracture-storm",
        name: "Fracture Storm",
        element: "wind",
        class: "warrior",
        type: "attack",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed_shock_lance",
        cardSlug: "creative-shock",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "042",
        rarity: 3,
        imageUrl: "https://images.ga.local/doa-042.png",
      },
      {
        id: "ed_storm_lance",
        cardSlug: "fracture-storm",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "043",
        rarity: 2,
        imageUrl: "https://images.ga.local/doa-043.png",
      },
    ]);
  });

  describe("Portfolio Dashboard (Empty /collection)", () => {
    it("returns high-level portfolio embed with friend code profile link when query is omitted", async () => {
      // Seed some collection items
      await db.insert(collectionItems).values([
        {
          id: "ci_1",
          userId: testCollectorId,
          editionId: "ed_shock_lance",
          foil: true,
          quantity: 2,
          isDedicated: false,
        },
        {
          id: "ci_2",
          userId: testCollectorId,
          editionId: "ed_storm_lance",
          foil: false,
          quantity: 3,
          isDedicated: true,
        },
      ]);

      const payload: DiscordInteractionPayload = {
        type: 2,
        id: "int_col_empty",
        token: "tok",
        data: {
          name: "collection",
          options: [],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const res = await handleDiscordInteraction(payload, db);
      expect(res.type).toBe(4);
      expect(res.data?.flags).toBe(64);
      expect(res.data?.embeds?.[0].title).toContain("Collection Portfolio");
      expect(res.data?.embeds?.[0].fields?.find((f) => f.name === "📦 Total Inventory")?.value).toContain("**5** Total Cards");
      expect(res.data?.embeds?.[0].fields?.find((f) => f.name === "✨ Finishes")?.value).toContain("Foil: **2**");
      expect(res.data?.embeds?.[0].fields?.find((f) => f.name === "🔗 Web Binder Profile")?.value).toContain("/u/GA-LANCE");
    });
  });

  describe("Personal Wants lifecycle (/wantlist add, remove, view)", () => {
    it("adds a card to personal wants and displays it in /wantlist view", async () => {
      // 1. /wantlist add card: creative-shock quantity: 2 foil: true
      const addPayload: DiscordInteractionPayload = {
        type: 2,
        id: "int_want_add",
        token: "tok",
        data: {
          name: "wantlist",
          options: [
            {
              name: "add",
              type: 1,
              options: [
                { name: "card", type: 3, value: "creative-shock" },
                { name: "quantity", type: 4, value: 2 },
                { name: "foil", type: 5, value: true },
              ],
            },
          ],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const addRes = await handleDiscordInteraction(addPayload, db);
      expect(addRes.type).toBe(4);
      expect(addRes.data?.embeds?.[0].title).toContain("Added to Personal Wants!");
      expect(addRes.data?.embeds?.[0].description).toContain("2x Creative Shock");

      // 2. /wantlist view
      const viewPayload: DiscordInteractionPayload = {
        type: 2,
        id: "int_want_view",
        token: "tok",
        data: {
          name: "wantlist",
          options: [{ name: "view", type: 1 }],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const viewRes = await handleDiscordInteraction(viewPayload, db);
      expect(viewRes.type).toBe(4);
      expect(viewRes.data?.embeds?.[0].title).toContain("Aggregate Wantlist");
      expect(viewRes.data?.embeds?.[0].fields?.find((f) => f.name.includes("Direct Wants"))?.value).toContain("Creative Shock");

      // 3. /wantlist remove card: creative-shock quantity: 1
      const remPayload: DiscordInteractionPayload = {
        type: 2,
        id: "int_want_rem",
        token: "tok",
        data: {
          name: "wantlist",
          options: [
            {
              name: "remove",
              type: 1,
              options: [
                { name: "card", type: 3, value: "creative-shock" },
                { name: "quantity", type: 4, value: 1 },
              ],
            },
          ],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const remRes = await handleDiscordInteraction(remPayload, db);
      expect(remRes.type).toBe(4);
      expect(remRes.data?.embeds?.[0].description).toContain("**1** remaining");
    });
  });

  describe("Omnidex Ingestion Modals and Gap Calculation", () => {
    it("returns modal type: 9 when /decks add is executed without URL", async () => {
      const payload: DiscordInteractionPayload = {
        type: 2,
        id: "int_deck_modal",
        token: "tok",
        data: {
          name: "decks",
          options: [{ name: "add", type: 1 }],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const res = await handleDiscordInteraction(payload, db);
      expect(res.type).toBe(9); // MODAL
      expect(res.data?.custom_id).toBe("modal_decks_add");
    });

    it("processes modal submit for modal_decks_add and creates a deck", async () => {
      const payload: DiscordInteractionPayload = {
        type: 5, // MODAL_SUBMIT
        id: "int_modal_sub_deck",
        token: "tok",
        data: {
          custom_id: "modal_decks_add",
          components: [
            {
              type: 1,
              components: [
                { type: 4, custom_id: "input_deck_name", value: "Modal Water Deck" },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "input_deck_text",
                  value: "Main Deck:\n2 Creative Shock\n",
                },
              ],
            },
          ],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const res = await handleDiscordInteraction(payload, db);
      expect(res.type).toBe(4);
      expect(res.data?.embeds?.[0].title).toContain("Imported Successfully");
    });

    it("processes modal submit for modal_wantlist_add_omnidex and adds only missing gap", async () => {
      // Lancelot owns 1 idle Creative Shock
      await db.insert(collectionItems).values({
        id: "ci_shock_idle",
        userId: testCollectorId,
        editionId: "ed_shock_lance",
        foil: false,
        quantity: 1,
        isDedicated: false,
      });

      // Deck requires 3 Creative Shock and 2 Fracture Storm
      const omnidexText = "Main Deck:\n3 Creative Shock\n2 Fracture Storm\n";

      const payload: DiscordInteractionPayload = {
        type: 5,
        id: "int_modal_sub_want",
        token: "tok",
        data: {
          custom_id: "modal_wantlist_add_omnidex",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "input_wantlist_text",
                  value: omnidexText,
                },
              ],
            },
          ],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const res = await handleDiscordInteraction(payload, db);
      expect(res.type).toBe(4);
      expect(res.data?.embeds?.[0].title).toContain("Omnidex Wantlist Gap Imported!");
      // 2 cards had deficits: Creative Shock deficit = 3 - 1 = 2; Fracture Storm deficit = 2 - 0 = 2. Total copies = 4.
      // 1 copy was already owned in binder and skipped.
      expect(res.data?.embeds?.[0].description).toContain("**2** missing cards");
      expect(res.data?.embeds?.[0].description).toContain("**4** total copies");
      expect(res.data?.embeds?.[0].description).toContain("**1** copies were already owned in your Binder and skipped");
    });
  });

  describe("Deal Alert Preferences (/wantlist notify)", () => {
    it("toggles and checks notification preference", async () => {
      // 1. Check current status
      const checkPayload: DiscordInteractionPayload = {
        type: 2,
        id: "int_notif_check",
        token: "tok",
        data: {
          name: "wantlist",
          options: [{ name: "notify", type: 1 }],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const checkRes = await handleDiscordInteraction(checkPayload, db);
      expect(checkRes.type).toBe(4);
      expect(checkRes.data?.embeds?.[0].description).toContain("Disabled 🔕");

      // 2. Enable notifications
      const enablePayload: DiscordInteractionPayload = {
        type: 2,
        id: "int_notif_enable",
        token: "tok",
        data: {
          name: "wantlist",
          options: [
            {
              name: "notify",
              type: 1,
              options: [{ name: "enable", type: 5, value: true }],
            },
          ],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const enableRes = await handleDiscordInteraction(enablePayload, db);
      expect(enableRes.type).toBe(4);
      expect(enableRes.data?.embeds?.[0].description).toContain("Deal notifications **Enabled**");

      // 3. Check status again
      const checkRes2 = await handleDiscordInteraction(checkPayload, db);
      expect(checkRes2.data?.embeds?.[0].description).toContain("Enabled 🔔");
    });

    it("sends a direct message confirmation to the user when enabling notifications", async () => {
      const dmSpy = vi.spyOn(dealNotifier, "sendDiscordDirectMessage").mockResolvedValue(true);

      const enablePayload: DiscordInteractionPayload = {
        type: 2,
        id: "int_notif_enable_dm",
        token: "tok",
        data: {
          name: "wantlist",
          options: [
            {
              name: "notify",
              type: 1,
              options: [{ name: "enable", type: 5, value: true }],
            },
          ],
        },
        user: { id: discordUserId, username: "Lancelot" },
      };

      const res = await handleDiscordInteraction(enablePayload, db);
      expect(res.type).toBe(4);
      expect(res.data?.embeds?.[0].description).toContain("Check your DMs");

      expect(dmSpy).toHaveBeenCalledWith(
        discordUserId,
        expect.objectContaining({
          title: "🔔 Deal Alerts Activated!",
          description: expect.stringContaining("Hey **Sir Lancelot**! I'll notify you here whenever any of your wantlist cards or deck shortages are for sale on the marketplace!"),
        })
      );
    });
  });
});
