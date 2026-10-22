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
import { users, cards, cardEditions, collectionItems } from "@/db/schema";
import { featuredSetGroups, setDefinitions } from "@/db/featured-set-schema";
import { DEFAULT_USER_ID } from "@/lib/default-user";
import { GET } from "../route";

async function seedChecklist() {
  await testDb.insert(users).values({
    id: DEFAULT_USER_ID,
    name: "Alex",
    friendCode: "GA-ALEX01",
  });

  await testDb.insert(cards).values([
    { slug: "fire-slash", name: "Fire Slash", element: "FIRE", class: "MAGE", type: "ACTION" },
    { slug: "water-bolt", name: "Water Bolt", element: "WATER", class: "TAMER", type: "ACTION" },
    { slug: "earth-shield", name: "Earth Shield", element: "EARTH", class: "WARRIOR", type: "REACTION" },
  ]);

  await testDb.insert(cardEditions).values([
    { id: "ed-fs", cardSlug: "fire-slash", setPrefix: "DOA 1st", setName: "Dawn of Ashes 1st", collectorNumber: "001", rarity: 3, imageUrl: "fs.jpg" },
    { id: "ed-wb", cardSlug: "water-bolt", setPrefix: "DOA 1st", setName: "Dawn of Ashes 1st", collectorNumber: "002", rarity: 2, imageUrl: "wb.jpg" },
    { id: "ed-es", cardSlug: "earth-shield", setPrefix: "DOA 1st", setName: "Dawn of Ashes 1st", collectorNumber: "003", rarity: 4, imageUrl: "es.jpg" },
  ]);

  await testDb.insert(featuredSetGroups).values([
    { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", imageUrl: "doa.png", sortOrder: 1 },
  ]);

  await testDb.insert(setDefinitions).values([
    { id: "def-doa", groupUuid: "grp-doa", prefix: "DOA 1st", name: "Dawn of Ashes 1st", language: "EN", releaseDate: "2023-05-15" },
  ]);

  // User owns 1 copy of Fire Slash
  await testDb.insert(collectionItems).values({
    id: "ci-fs",
    userId: DEFAULT_USER_ID,
    editionId: "ed-fs",
    foil: false,
    quantity: 1,
  });
}

describe("Sets Checklist API Route (GET /api/sets/[groupSlug])", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;
  });

  it("returns group, checklist, and summary for a known slug", async () => {
    await seedChecklist();

    const req = new NextRequest("http://localhost:3000/api/sets/dawn-of-ashes");
    const res = await GET(req, { params: { groupSlug: "dawn-of-ashes" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.group.slug).toBe("dawn-of-ashes");
    expect(json.group.name).toBe("Dawn of Ashes");
    expect(Array.isArray(json.checklist)).toBe(true);
    expect(json.checklist).toHaveLength(3);
    expect(json.summary.totalCardsAcrossGroups).toBe(3);
    expect(json.summary.totalOwnedCardsAcrossGroups).toBe(1);
  });

  it("returns 404 with an error for an unknown slug", async () => {
    await seedChecklist();

    const req = new NextRequest("http://localhost:3000/api/sets/nonexistent-set");
    const res = await GET(req, { params: { groupSlug: "nonexistent-set" } });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it("forwards element and rarity filters to the checklist", async () => {
    await seedChecklist();

    const elementReq = new NextRequest("http://localhost:3000/api/sets/dawn-of-ashes?element=FIRE");
    const elementRes = await GET(elementReq, { params: { groupSlug: "dawn-of-ashes" } });
    const elementJson = await elementRes.json();
    expect(elementRes.status).toBe(200);
    expect(elementJson.checklist).toHaveLength(1);
    expect(elementJson.checklist[0].cardSlug).toBe("fire-slash");

    const rarityReq = new NextRequest("http://localhost:3000/api/sets/dawn-of-ashes?rarity=2");
    const rarityRes = await GET(rarityReq, { params: { groupSlug: "dawn-of-ashes" } });
    const rarityJson = await rarityRes.json();
    expect(rarityRes.status).toBe(200);
    expect(rarityJson.checklist).toHaveLength(1);
    expect(rarityJson.checklist[0].cardSlug).toBe("water-bolt");
  });

  it("forwards status and search filters to the checklist", async () => {
    await seedChecklist();

    const ownedReq = new NextRequest("http://localhost:3000/api/sets/dawn-of-ashes?status=owned");
    const ownedRes = await GET(ownedReq, { params: { groupSlug: "dawn-of-ashes" } });
    const ownedJson = await ownedRes.json();
    expect(ownedJson.checklist).toHaveLength(1);
    expect(ownedJson.checklist[0].cardSlug).toBe("fire-slash");

    const searchReq = new NextRequest("http://localhost:3000/api/sets/dawn-of-ashes?search=bolt");
    const searchRes = await GET(searchReq, { params: { groupSlug: "dawn-of-ashes" } });
    const searchJson = await searchRes.json();
    expect(searchJson.checklist).toHaveLength(1);
    expect(searchJson.checklist[0].cardSlug).toBe("water-bolt");
  });
});