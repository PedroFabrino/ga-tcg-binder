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
import { users } from "@/db/schema";
import { featuredSetGroups } from "@/db/featured-set-schema";
import { DEFAULT_USER_ID } from "@/lib/default-user";
import { POST } from "../route";
import { GET as GET_SETS } from "../../route";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/sets/hide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedUserAndGroup() {
  await testDb.insert(users).values({
    id: DEFAULT_USER_ID,
    name: "Alex",
    friendCode: "GA-ALEX01",
  });
  await testDb.insert(featuredSetGroups).values({
    uuid: "grp-doa",
    name: "Dawn of Ashes",
    slug: "dawn-of-ashes",
    imageUrl: "doa.png",
    sortOrder: 1,
  });
}

describe("Hide Set API Route (POST /api/sets/hide)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;
  });

  it("hides a set and returns the updated hidden UUIDs", async () => {
    await seedUserAndGroup();

    const res = await POST(jsonRequest({ groupUuid: "grp-doa", isHidden: true }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.hiddenSetUuids).toEqual(["grp-doa"]);
  });

  it("unhides a previously hidden set", async () => {
    await seedUserAndGroup();

    await POST(jsonRequest({ groupUuid: "grp-doa", isHidden: true }));
    const res = await POST(jsonRequest({ groupUuid: "grp-doa", isHidden: false }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.hiddenSetUuids).toEqual([]);
  });

  it("reflects isHidden and hiddenCount in GET /api/sets after hide", async () => {
    await seedUserAndGroup();

    await POST(jsonRequest({ groupUuid: "grp-doa", isHidden: true }));

    const getRes = await GET_SETS(new NextRequest("http://localhost:3000/api/sets"));
    const getJson = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getJson.hiddenCount).toBe(1);
    const doa = getJson.groups.find((g: { slug: string }) => g.slug === "dawn-of-ashes");
    expect(doa.isHidden).toBe(true);
  });

  it("returns 400 for an invalid body", async () => {
    await seedUserAndGroup();

    const missingGroup = await POST(jsonRequest({ isHidden: true }));
    expect(missingGroup.status).toBe(400);
    expect((await missingGroup.json()).error).toBeDefined();

    const nonBoolean = await POST(jsonRequest({ groupUuid: "grp-doa", isHidden: "yes" }));
    expect(nonBoolean.status).toBe(400);
    expect((await nonBoolean.json()).error).toBeDefined();
  });

  it("returns 404 for an unknown group", async () => {
    await seedUserAndGroup();

    const res = await POST(jsonRequest({ groupUuid: "grp-missing", isHidden: true }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });
});