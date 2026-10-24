import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../test-utils";
import { cards } from "../../schema";
import {
  findCardByNameCaseInsensitive,
  findCardsByNamesCaseInsensitive,
} from "../collection-repository";

describe("collection-repository card queries", () => {
  let db: any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

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
  });

  it("finds single card by case-insensitive name", async () => {
    const card = await findCardByNameCaseInsensitive("creative shock", db);
    expect(card?.slug).toBe("creative-shock");

    const nonExistent = await findCardByNameCaseInsensitive("Unknown Card", db);
    expect(nonExistent).toBeUndefined();
  });

  it("finds multiple cards by case-insensitive names in batch", async () => {
    const results = await findCardsByNamesCaseInsensitive(
      ["CREATIVE SHOCK", "fracture storm", "Nonexistent"],
      db
    );
    expect(results).toHaveLength(2);
    expect(results.map((r: any) => r.slug).sort()).toEqual(["creative-shock", "fracture-storm"]);

    const empty = await findCardsByNamesCaseInsensitive([], db);
    expect(empty).toEqual([]);
  });
});
