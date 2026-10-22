import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "@/db/test-utils";
import {
  getAllFeaturedSetGroups,
} from "@/db/repositories/set-repository";
import { syncFeaturedSetsFromApi } from "../featured-set-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- following existing repository test convention
let db: any;

/** Two-group fixture matching the real https://api.gatcg.com/featured-sets shape */
const TWO_GROUP_FIXTURE = [
  {
    uuid: "gzXew51qTM",
    name: ".asphodel/paradise",
    image: "/featured-sets/images/PRD.png",
    sets: [
      {
        id: "ff6ed80e87",
        name: ".asphodel/paradise",
        prefix: "PRD",
        language: "EN",
        release_date: "2026-08-21T00:00:00",
      },
      {
        id: "7efbdeb5f2",
        name: ".asphodel/paradise First Edition",
        prefix: "PRD 1st",
        language: "EN",
        release_date: "2026-08-21T00:00:00",
      },
    ],
  },
  {
    uuid: "abc123def456",
    name: "Dawn of Ashes",
    image: "/featured-sets/images/DOA.png",
    sets: [
      {
        id: "abc111",
        name: "Dawn of Ashes",
        prefix: "DOA",
        language: "EN",
        release_date: "2023-04-28T00:00:00",
      },
      {
        id: "abc222",
        name: "Dawn of Ashes 1st Edition",
        prefix: "DOA 1st",
        language: "EN",
        release_date: "2023-04-28T00:00:00",
      },
    ],
  },
];

describe("featured-set-sync", () => {
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
  });

  const fakeFetch = (body: unknown) =>
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });

  // -----------------------------------------------------------------------
  // Basic sync
  // -----------------------------------------------------------------------
  it("parses two-group fixture into 2 groups + 4 definitions", async () => {
    const fetchMock = fakeFetch(TWO_GROUP_FIXTURE);

    const stats = await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    expect(stats.featuredSetGroupsSynced).toBe(2);
    expect(stats.setDefinitionsSynced).toBe(4);

    const groups = await getAllFeaturedSetGroups(db);
    expect(groups).toHaveLength(2);

    // sortOrder = API array index
    expect(groups[0].name).toBe(".asphodel/paradise");
    expect(groups[0].sortOrder).toBe(0);
    expect(groups[0].slug).toBe("asphodel-paradise");
    expect(groups[0].imageUrl).toBe(
      "https://api.gatcg.com/featured-sets/images/PRD.png"
    );

    expect(groups[1].name).toBe("Dawn of Ashes");
    expect(groups[1].sortOrder).toBe(1);
    expect(groups[1].slug).toBe("dawn-of-ashes");
    expect(groups[1].imageUrl).toBe(
      "https://api.gatcg.com/featured-sets/images/DOA.png"
    );

    expect(groups[0].setDefinitions).toHaveLength(2);
    expect(groups[1].setDefinitions).toHaveLength(2);

    // Verify one definition in detail
    const firstSet = groups[0].setDefinitions[0];
    expect(firstSet.id).toBe("ff6ed80e87");
    expect(firstSet.prefix).toBe("PRD");
    expect(firstSet.language).toBe("EN");
    expect(firstSet.releaseDate).toBe("2026-08-21");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.gatcg.com/featured-sets");
  });

  // -----------------------------------------------------------------------
  // Upsert stability
  // -----------------------------------------------------------------------
  it("re-running with a renamed group updates in place and keeps row counts stable", async () => {
    // First sync
    let fetchMock = fakeFetch(TWO_GROUP_FIXTURE);
    await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    // Modify fixture: rename first group, keep same uuid
    const updatedFixture = structuredClone(TWO_GROUP_FIXTURE);
    updatedFixture[0].name = ".asphodel/paradise Renamed";

    fetchMock = fakeFetch(updatedFixture);
    await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    const groups = await getAllFeaturedSetGroups(db);
    expect(groups).toHaveLength(2); // No new group created
    expect(groups[0].name).toBe(".asphodel/paradise Renamed");
    // slug updates too
    expect(groups[0].slug).toBe("asphodel-paradise-renamed");
    expect(groups[0].setDefinitions).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Slug uniqueness
  // -----------------------------------------------------------------------
  it("duplicate display names get distinct slugs", async () => {
    // Three groups with identical names but different uuids
    const fixture = [
      {
        uuid: "dup-1",
        name: "Same Name",
        image: "",
        sets: [{ id: "s1", name: "Set 1", prefix: "S1", language: "EN", release_date: null }],
      },
      {
        uuid: "dup-2",
        name: "Same Name",
        image: "",
        sets: [{ id: "s2", name: "Set 2", prefix: "S2", language: "EN", release_date: null }],
      },
      {
        uuid: "dup-3",
        name: "Same Name",
        image: "",
        sets: [{ id: "s3", name: "Set 3", prefix: "S3", language: "EN", release_date: null }],
      },
    ];

    const fetchMock = fakeFetch(fixture);
    await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    const groups = await getAllFeaturedSetGroups(db);
    expect(groups).toHaveLength(3);

    const slugs = groups.map((g: { slug: string }) => g.slug).sort();
    expect(slugs[0]).toBe("same-name");
    expect(slugs[1]).toBe("same-name-2");
    expect(slugs[2]).toBe("same-name-3");
  });

  // -----------------------------------------------------------------------
  // Relative image becomes absolute
  // -----------------------------------------------------------------------
  it("relative image becomes absolute URL", async () => {
    const fixture = [
      {
        uuid: "img-1",
        name: "Image Test",
        image: "/some/relative/path.png",
        sets: [],
      },
    ];

    const fetchMock = fakeFetch(fixture);
    await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    const groups = await getAllFeaturedSetGroups(db);
    expect(groups[0].imageUrl).toBe("https://api.gatcg.com/some/relative/path.png");
  });

  // -----------------------------------------------------------------------
  // Release date normalization
  // -----------------------------------------------------------------------
  it("release dates are normalized to YYYY-MM-DD", async () => {
    const fixture = [
      {
        uuid: "rel-1",
        name: "Release Date Test",
        image: "",
        sets: [
          {
            id: "rd1",
            name: "Has Date",
            prefix: "HD",
            language: "EN",
            release_date: "2025-11-15T13:45:30.123Z",
          },
          {
            id: "rd2",
            name: "No Date",
            prefix: "ND",
            language: "EN",
            release_date: null,
          },
          {
            id: "rd3",
            name: "Date Only",
            prefix: "DO",
            language: "EN",
            release_date: "2024-01-01",
          },
        ],
      },
    ];

    const fetchMock = fakeFetch(fixture);
    await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    const groups = await getAllFeaturedSetGroups(db);
    const defs = groups[0].setDefinitions;

    const hasDate = defs.find((d: { id: string }) => d.id === "rd1");
    expect(hasDate?.releaseDate).toBe("2025-11-15");

    const noDate = defs.find((d: { id: string }) => d.id === "rd2");
    expect(noDate?.releaseDate).toBeNull();

    const dateOnly = defs.find((d: { id: string }) => d.id === "rd3");
    expect(dateOnly?.releaseDate).toBe("2024-01-01");
  });

  // -----------------------------------------------------------------------
  // No real network calls
  // -----------------------------------------------------------------------
  it("uses injected fetchImpl and never calls real fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The global fetch was never called because fetchImpl was injected
  });

  // -----------------------------------------------------------------------
  // Failure propagates
  // -----------------------------------------------------------------------
  it("throws on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/featured.sets/i);
  });

  // -----------------------------------------------------------------------
  // Empty sets array
  // -----------------------------------------------------------------------
  it("handles groups with empty sets arrays", async () => {
    const fixture = [
      {
        uuid: "empty-1",
        name: "Empty Group",
        image: "",
        sets: [],
      },
    ];

    const fetchMock = fakeFetch(fixture);
    const stats = await syncFeaturedSetsFromApi(db, fetchMock as unknown as typeof fetch);

    expect(stats.featuredSetGroupsSynced).toBe(1);
    expect(stats.setDefinitionsSynced).toBe(0);

    const groups = await getAllFeaturedSetGroups(db);
    expect(groups).toHaveLength(1);
    expect(groups[0].setDefinitions).toHaveLength(0);
  });
});