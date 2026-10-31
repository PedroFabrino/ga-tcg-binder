import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../test-utils";
import { users } from "../schema";
import { migrateDeckSectionsAndPriorities } from "../init";

describe("migration-deck-sections", () => {
  let client: any;
  let db: any;
  const user1 = "user_test_1";
  const user2 = "user_test_2";

  beforeEach(async () => {
    const testDb = await createTestDb();
    client = testDb.client;
    db = testDb.db;

    await db.insert(users).values([
      { id: user1, name: "Player 1", email: "p1@test.local", friendCode: "P1-CODE", locale: "en" },
      { id: user2, name: "Player 2", email: "p2@test.local", friendCode: "P2-CODE", locale: "en" },
    ]);
  });

  it("backfills section to 4fun when empty", async () => {
    // Insert deck with empty section using raw SQL
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '', 0, 1000)",
      args: ["deck_empty_sec", user1, "Empty Section Deck"],
    });

    await migrateDeckSectionsAndPriorities(client);

    const res = await client.execute({
      sql: "SELECT `section` FROM `decks` WHERE `id` = ?",
      args: ["deck_empty_sec"],
    });

    expect(res.rows[0].section).toBe("4fun");
  });

  it("re-sequences collided priorities to 0, 1, 2... based on created_at ASC", async () => {
    // Insert 3 decks for user1 all with priority 0 (as occurs when adding column with DEFAULT 0)
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 100)",
      args: ["d1", user1, "Deck 1"],
    });
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 300)",
      args: ["d3", user1, "Deck 3"],
    });
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 200)",
      args: ["d2", user1, "Deck 2"],
    });

    await migrateDeckSectionsAndPriorities(client);

    const res = await client.execute({
      sql: "SELECT `id`, `priority` FROM `decks` WHERE `user_id` = ? ORDER BY `priority` ASC",
      args: [user1],
    });

    expect(res.rows).toHaveLength(3);
    expect(res.rows[0].id).toBe("d1");
    expect(res.rows[0].priority).toBe(0);
    expect(res.rows[1].id).toBe("d2");
    expect(res.rows[1].priority).toBe(1);
    expect(res.rows[2].id).toBe("d3");
    expect(res.rows[2].priority).toBe(2);
  });

  it("partitions re-sequencing independently per user and per section", async () => {
    // User 1 has 2 competitive decks with collision and 2 4fun decks with collision
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, 'competitive', 0, 10)",
      args: ["c1", user1, "Comp 1"],
    });
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, 'competitive', 0, 20)",
      args: ["c2", user1, "Comp 2"],
    });
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 10)",
      args: ["f1", user1, "Fun 1"],
    });
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 20)",
      args: ["f2", user1, "Fun 2"],
    });

    // User 2 has 2 decks with collision
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 50)",
      args: ["u2_d1", user2, "User2 Fun 1"],
    });
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 60)",
      args: ["u2_d2", user2, "User2 Fun 2"],
    });

    await migrateDeckSectionsAndPriorities(client);

    const compDecks = await client.execute({
      sql: "SELECT `id`, `priority` FROM `decks` WHERE `user_id` = ? AND `section` = 'competitive' ORDER BY `priority` ASC",
      args: [user1],
    });
    expect(compDecks.rows.map((r: any) => ({ id: r.id, priority: r.priority }))).toEqual([
      { id: "c1", priority: 0 },
      { id: "c2", priority: 1 },
    ]);

    const funDecks = await client.execute({
      sql: "SELECT `id`, `priority` FROM `decks` WHERE `user_id` = ? AND `section` = '4fun' ORDER BY `priority` ASC",
      args: [user1],
    });
    expect(funDecks.rows.map((r: any) => ({ id: r.id, priority: r.priority }))).toEqual([
      { id: "f1", priority: 0 },
      { id: "f2", priority: 1 },
    ]);

    const u2Decks = await client.execute({
      sql: "SELECT `id`, `priority` FROM `decks` WHERE `user_id` = ? ORDER BY `priority` ASC",
      args: [user2],
    });
    expect(u2Decks.rows.map((r: any) => ({ id: r.id, priority: r.priority }))).toEqual([
      { id: "u2_d1", priority: 0 },
      { id: "u2_d2", priority: 1 },
    ]);
  });

  it("preserves explicitly ordered decks when no collisions exist", async () => {
    // User 1 has custom order: d2 has priority 0, d1 has priority 1
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 1, 100)",
      args: ["d1", user1, "Deck 1 (Older)"],
    });
    await client.execute({
      sql: "INSERT INTO `decks` (`id`, `user_id`, `name`, `section`, `priority`, `created_at`) VALUES (?, ?, ?, '4fun', 0, 200)",
      args: ["d2", user1, "Deck 2 (Newer, dragged to top)"],
    });

    await migrateDeckSectionsAndPriorities(client);

    const res = await client.execute({
      sql: "SELECT `id`, `priority` FROM `decks` WHERE `user_id` = ? ORDER BY `priority` ASC",
      args: [user1],
    });

    // Should NOT reset to created_at order!
    expect(res.rows[0].id).toBe("d2");
    expect(res.rows[0].priority).toBe(0);
    expect(res.rows[1].id).toBe("d1");
    expect(res.rows[1].priority).toBe(1);
  });
});
