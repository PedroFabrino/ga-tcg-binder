import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test db convenience
let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_, prop) => testDb?.[prop],
    },
  ),
}));

import { createTestDb } from "@/db/test-utils";
import { users, cards, cardEditions, decks, deckCards } from "@/db/schema";
import { featuredSetGroups, setDefinitions } from "@/db/featured-set-schema";
import { DEFAULT_USER_ID } from "@/lib/default-user";
import { GET } from "../route";

async function seedUser() {
  await testDb.insert(users).values({
    id: DEFAULT_USER_ID,
    name: "Alex",
    friendCode: "GA-ALEX01",
  });
}

async function seedRankedCatalog() {
  await testDb.insert(cards).values([
    { slug: "fire-slash", name: "Fire Slash", element: "FIRE", class: "MAGE", type: "ACTION" },
    { slug: "water-bolt", name: "Water Bolt", element: "WATER", class: "TAMER", type: "ACTION" },
  ]);

  await testDb.insert(cardEditions).values([
    { id: "ed-fs", cardSlug: "fire-slash", setPrefix: "DOA 1st", setName: "Dawn of Ashes 1st", collectorNumber: "001", rarity: 3, imageUrl: "fs.jpg" },
    { id: "ed-wb", cardSlug: "water-bolt", setPrefix: "ACR", setName: "Alchemical Revolution", collectorNumber: "002", rarity: 2, imageUrl: "wb.jpg" },
  ]);

  await testDb.insert(featuredSetGroups).values([
    { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", imageUrl: "doa.png", sortOrder: 1 },
    { uuid: "grp-acr", name: "Alchemical Revolution", slug: "alchemical-revolution", imageUrl: "acr.png", sortOrder: 2 },
  ]);

  await testDb.insert(setDefinitions).values([
    { id: "def-doa", groupUuid: "grp-doa", prefix: "DOA 1st", name: "Dawn of Ashes 1st", language: "EN", releaseDate: "2023-05-15" },
    { id: "def-acr", groupUuid: "grp-acr", prefix: "ACR", name: "Alchemical Revolution", language: "EN", releaseDate: "2024-01-10" },
  ]);

  await testDb.insert(decks).values({ id: "deck-1", userId: DEFAULT_USER_ID, name: "Burn", format: "standard" });
  await testDb.insert(deckCards).values({ id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 3 });
}

describe("Sets API Route (GET /api/sets)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;
  });

  it("returns ranked groups and hiddenCount for the seeded user", async () => {
    await seedUser();
    await seedRankedCatalog();

    const req = new NextRequest("http://localhost:3000/api/sets");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.groups)).toBe(true);
    expect(json.groups.length).toBe(2);
    expect(json.hiddenCount).toBe(0);

    const doa = json.groups.find((g: { slug: string }) => g.slug === "dawn-of-ashes");
    expect(doa).toBeDefined();
    expect(doa.totalShortageCopies).toBe(3);
    expect(doa.isHidden).toBe(false);

    // Ranked by total shortage descending: DOA (3) before ACR (0)
    expect(json.groups[0].slug).toBe("dawn-of-ashes");
  });

  it("returns empty groups and zero hiddenCount for an empty catalog", async () => {
    await seedUser();

    const req = new NextRequest("http://localhost:3000/api/sets");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.groups).toEqual([]);
    expect(json.hiddenCount).toBe(0);
  });
});