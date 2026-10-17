import { describe, it, expect } from "vitest";
import { parseStaplesHtml, syncMetaStaples, getMetaStaples } from "./meta-staples";
import { createTestDb } from "../db/test-utils";
import { cards, cardEditions, metaStaples } from "../db/schema";

const SAMPLE_STAPLES_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="staples-container">
    <div class="staples-section">
      <h2 class="section-title">Divine Relics</h2>
      <div class="gt-card-tile" data-card-name="Grand Crusader" data-inclusion="94.5%" data-avg-copies="1.0" data-decks="120">
        <a class="card-link" href="/cards/grand-crusader">Grand Crusader</a>
        <div class="stat-inclusion">94.5%</div>
        <div class="stat-copies">1.0 avg</div>
        <img src="https://example.com/gc.jpg" />
      </div>
      <!-- Low sample tile to be filtered out -->
      <div class="gt-card-tile low-n" data-card-name="Niche Relic" data-inclusion="1.5%" data-avg-copies="1.0" data-decks="2">
        <a class="card-link" href="/cards/niche-relic">Niche Relic</a>
        <div class="stat-inclusion">1.5%</div>
        <div class="stat-copies">1.0 avg</div>
      </div>
    </div>

    <div class="staples-section">
      <h2 class="section-title">Water Main Deck</h2>
      <!-- Card with 3.2 avg copies -> recommendedCopies should be ceil(3.2) = 4 -->
      <div class="gt-card-tile" data-card-name="Fracturize" data-inclusion="88.2%" data-avg-copies="3.2" data-decks="112">
        <span class="card-name">Fracturize</span>
        <div class="stat-inclusion">88.2%</div>
        <div class="stat-copies">3.2 avg</div>
        <img src="https://example.com/frac.jpg" />
      </div>
      <!-- Under 2.0% inclusion without low-n class -> should be filtered out -->
      <div class="gt-card-tile" data-card-name="Obscure Spell" data-inclusion="1.8%" data-avg-copies="2.0" data-decks="3">
        <span class="card-name">Obscure Spell</span>
        <div class="stat-inclusion">1.8%</div>
        <div class="stat-copies">2.0 avg</div>
      </div>
    </div>

    <div class="staples-section">
      <h2 class="section-title">Sideboard Tech</h2>
      <!-- Fracturize also appears here with lower inclusion -> should deduplicate and merge categories -->
      <div class="gt-card-tile" data-card-name="Fracturize" data-inclusion="12.0%" data-avg-copies="1.5" data-decks="15">
        <span class="card-name">Fracturize</span>
        <div class="stat-inclusion">12.0%</div>
        <div class="stat-copies">1.5 avg</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

describe("Meta Staples Ingestion Service Seam", () => {
  it("parses staples HTML, excludes low-n and <2% inclusion, merges multi-section categories and computes recommendedCopies", () => {
    const parsed = parseStaplesHtml(SAMPLE_STAPLES_HTML);

    expect(parsed).toHaveLength(2);

    const grandCrusader = parsed.find((p) => p.cardName === "Grand Crusader");
    expect(grandCrusader).toBeDefined();
    expect(grandCrusader?.categories).toEqual(["Divine Relics"]);
    expect(grandCrusader?.primaryCategory).toBe("Divine Relics");
    expect(grandCrusader?.recommendedCopies).toBe(1); // Relics are 1
    expect(grandCrusader?.inclusionRate).toBe("94.5%");
    expect(grandCrusader?.avgCopies).toBe("1.0");

    const fracturize = parsed.find((p) => p.cardName === "Fracturize");
    expect(fracturize).toBeDefined();
    expect(fracturize?.categories).toContain("Water Main Deck");
    expect(fracturize?.categories).toContain("Sideboard Tech");
    expect(fracturize?.primaryCategory).toBe("Water Main Deck");
    // Max inclusion: 88.2%, Max avg: 3.2 -> ceil(3.2) = 4
    expect(fracturize?.inclusionRate).toBe("88.2%");
    expect(fracturize?.avgCopies).toBe("3.2");
    expect(fracturize?.recommendedCopies).toBe(4);
  });

  it("syncMetaStaples persists records and updates database", async () => {
    const { db } = await createTestDb();

    // Insert canonical cards
    await db.insert(cards).values([
      {
        slug: "grand-crusader",
        name: "Grand Crusader",
        element: "NORM",
        class: "WARRIOR",
        type: "REGALIA",
        subtypes: "[]",
      },
      {
        slug: "fracturize",
        name: "Fracturize",
        element: "NORM",
        class: "WARRIOR",
        type: "ACTION",
        subtypes: "[]",
      },
    ]);

    const mockFetch = async () => ({
      ok: true,
      text: async () => SAMPLE_STAPLES_HTML,
    });

    const result = await syncMetaStaples(db, mockFetch as any);
    expect(result.syncedCount).toBe(2);

    const staples = await getMetaStaples(db);
    expect(staples).toHaveLength(2);

    const frac = staples.find((s: any) => s.cardSlug === "fracturize");
    expect(frac).toBeDefined();
    expect(frac?.recommendedCopies).toBe(4);
    expect(JSON.parse(frac?.categories || "[]")).toEqual(["Water Main Deck", "Sideboard Tech"]);
  });

  it("preserves cached staples if upstream fetch fails", async () => {
    const { db } = await createTestDb();

    await db.insert(cards).values([
      {
        slug: "fracturize",
        name: "Fracturize",
        element: "NORM",
        class: "WARRIOR",
        type: "ACTION",
        subtypes: "[]",
      },
    ]);

    const goodFetch = async () => ({
      ok: true,
      text: async () => SAMPLE_STAPLES_HTML,
    });
    await syncMetaStaples(db, goodFetch as any);

    // Now fail
    const failingFetch = async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(syncMetaStaples(db, failingFetch as any)).rejects.toThrow();

    // Cache remains
    const staples = await getMetaStaples(db);
    expect(staples.length).toBeGreaterThan(0);
  });
});
