import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { cards, cardEditions, cardHashes } from "../db/schema";
import { identifyCard } from "./scanner-match";

async function seed() {
  const { db } = await createTestDb();
  const mk = async (slug: string, name: string, prefix: string, num: string, hash: string) => {
    await db.insert(cards).values({ slug, name, element: "NORM", class: "WARRIOR", type: "ACTION", subtypes: "[]" });
    const id = `ed-${slug}`;
    await db.insert(cardEditions).values({
      id, cardSlug: slug, setPrefix: prefix, setName: "Set", collectorNumber: num, rarity: 1, imageUrl: `https://x/${slug}.jpg`,
    });
    await db.insert(cardHashes).values({ editionId: id, phash: hash });
  };
  await mk("fracturize", "Fracturize", "DOA", "001", "0000000000000000");
  await mk("lorraine", "Lorraine, Blademaster", "DOA", "042", "00000000000000ff");
  await mk("other", "Something Else", "RDO", "250", "ffffffffffffffff");
  return db;
}

describe("identifyCard", () => {
  it("ranks by composite confidence and boosts exact collector match", async () => {
    const db = await seed();
    const res = await identifyCard(
      { phash: "0000000000000000", headerText: "Fracturize", footerText: "DOA 001" },
      db
    );
    expect(res[0].cardSlug).toBe("fracturize");
    expect(res[0].confidence).toBeGreaterThanOrEqual(90);
    expect(res[0].signals.collectorMatch).toBe(true);
    expect(res.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].confidence).toBeGreaterThanOrEqual(res[i].confidence);
  });

  it("falls back to visual-only capped at 92 when OCR is noise", async () => {
    const db = await seed();
    const res = await identifyCard({ phash: "0000000000000000", headerText: "#$|", footerText: "" }, db);
    expect(res[0].cardSlug).toBe("fracturize");
    expect(res[0].confidence).toBe(92);
    expect(res[0].signals.ocrFallback).toBe(true);
    expect(res[0].sOcr).toBeNull();
  });

  it("lets OCR disambiguate near-identical visuals", async () => {
    const db = await seed();
    const res = await identifyCard(
      { phash: "0000000000000004", headerText: "Lorraine, Blademaster", footerText: "DOA 042" },
      db
    );
    expect(res[0].cardSlug).toBe("lorraine");
  });
});
