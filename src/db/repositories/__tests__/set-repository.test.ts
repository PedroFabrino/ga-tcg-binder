import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../test-utils";
import { users as usersTable, featuredSetGroups } from "../../schema";
import {
  getAllFeaturedSetGroups,
  getFeaturedSetGroupBySlug,
  getFeaturedSetGroupByUuid,
  upsertFeaturedSetGroup,
  upsertSetDefinition,
  getUserHiddenSetUuids,
  setUserHiddenSetUuids,
} from "../set-repository";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- following existing repository test convention
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDbClient: any;

describe("set-repository", () => {
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    testDbClient = testDb.client;
  });

  // -----------------------------------------------------------------------
  // Featured Set Groups
  // -----------------------------------------------------------------------
  describe("getAllFeaturedSetGroups", () => {
    it("returns empty array when no groups exist", async () => {
      const groups = await getAllFeaturedSetGroups(db);
      expect(groups).toEqual([]);
    });

    it("returns groups ordered by sortOrder then name", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-c", name: "C Set", slug: "c-set", sortOrder: 3 },
        db,
      );
      await upsertFeaturedSetGroup(
        { uuid: "grp-a", name: "A Set", slug: "a-set", sortOrder: 1 },
        db,
      );
      await upsertFeaturedSetGroup(
        { uuid: "grp-b", name: "B Set", slug: "b-set", sortOrder: 2 },
        db,
      );
      await upsertFeaturedSetGroup(
        { uuid: "grp-another-b", name: "Another B", slug: "another-b", sortOrder: 2 },
        db,
      );

      const groups = await getAllFeaturedSetGroups(db);
      expect(groups).toHaveLength(4);
      expect(groups[0].slug).toBe("a-set");
      // same sortOrder (2), alphabetical by name: "Another B" < "B Set"
      expect(groups[1].slug).toBe("another-b");
      expect(groups[2].slug).toBe("b-set");
      expect(groups[3].slug).toBe("c-set");
    });

    it("includes nested set definitions when available", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", sortOrder: 1 },
        db,
      );
      await upsertSetDefinition(
        { id: "set-doa-1st", groupUuid: "grp-doa", prefix: "DOA 1st", name: "DOA 1st Edition" },
        db,
      );
      await upsertSetDefinition(
        { id: "set-doa-alt", groupUuid: "grp-doa", prefix: "DOA Alter", name: "DOA Alter Edition" },
        db,
      );

      const groups = await getAllFeaturedSetGroups(db);
      expect(groups).toHaveLength(1);
      expect(groups[0].setDefinitions).toHaveLength(2);
      expect(groups[0].setDefinitions[0].prefix).toBe("DOA 1st");
      expect(groups[0].setDefinitions[1].prefix).toBe("DOA Alter");
    });
  });

  // -----------------------------------------------------------------------
  // Upsert Featured Set Group
  // -----------------------------------------------------------------------
  describe("upsertFeaturedSetGroup", () => {
    it("inserts a new group with all fields", async () => {
      const group = await upsertFeaturedSetGroup(
        {
          uuid: "grp-doa",
          name: "Dawn of Ashes",
          slug: "dawn-of-ashes",
          imageUrl: "https://images.ga.local/doa.png",
          sortOrder: 1,
        },
        db,
      );

      expect(group.uuid).toBe("grp-doa");
      expect(group.name).toBe("Dawn of Ashes");
      expect(group.slug).toBe("dawn-of-ashes");
      expect(group.imageUrl).toBe("https://images.ga.local/doa.png");
      expect(group.sortOrder).toBe(1);
      expect(group.createdAt).toBeInstanceOf(Date);
      expect(group.updatedAt).toBeInstanceOf(Date);
    });

    it("defaults sortOrder to 0 when omitted", async () => {
      const group = await upsertFeaturedSetGroup(
        { uuid: "grp-min", name: "Minimal", slug: "minimal" },
        db,
      );

      expect(group.sortOrder).toBe(0);
    });

    it("updates an existing group and refreshes updatedAt", async () => {
      const result = await upsertFeaturedSetGroup(
        { uuid: "grp-alc", name: "Alchemical Revolution", slug: "alchemical-revolution", sortOrder: 2 },
        db,
      );

      // Store the original updatedAt for later comparison
      const firstUpdatedAt = result.updatedAt!;

      // Sleep to advance the clock past the second boundary
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const updated = await upsertFeaturedSetGroup(
        { uuid: "grp-alc", name: "Alchemical Revolution Rev", slug: "alchemical-revolution", sortOrder: 5 },
        db,
      );

      expect(updated.name).toBe("Alchemical Revolution Rev");
      expect(updated.sortOrder).toBe(5);
      expect(updated.slug).toBe("alchemical-revolution");
      expect(updated.updatedAt!.getTime()).toBeGreaterThan(firstUpdatedAt.getTime());
    });
  });

  // -----------------------------------------------------------------------
  // Lookup by Slug / Uuid
  // -----------------------------------------------------------------------
  describe("getFeaturedSetGroupBySlug and getFeaturedSetGroupByUuid", () => {
    it("retrieves group by slug with nested definitions", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", sortOrder: 1 },
        db,
      );
      await upsertSetDefinition(
        { id: "set-doa-1st", groupUuid: "grp-doa", prefix: "DOA 1st", name: "DOA 1st Edition" },
        db,
      );

      const group = await getFeaturedSetGroupBySlug("dawn-of-ashes", db);
      expect(group).not.toBeNull();
      expect(group!.name).toBe("Dawn of Ashes");
      expect(group!.setDefinitions).toHaveLength(1);
      expect(group!.setDefinitions[0].prefix).toBe("DOA 1st");
    });

    it("retrieves group by uuid with nested definitions", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", sortOrder: 1 },
        db,
      );

      const group = await getFeaturedSetGroupByUuid("grp-doa", db);
      expect(group).not.toBeNull();
      expect(group!.name).toBe("Dawn of Ashes");
      expect(group!.setDefinitions).toEqual([]);
    });

    it("returns null for non-existent slug", async () => {
      const group = await getFeaturedSetGroupBySlug("non-existent", db);
      expect(group).toBeNull();
    });

    it("returns null for non-existent uuid", async () => {
      const group = await getFeaturedSetGroupByUuid("non-existent-uuid", db);
      expect(group).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Upsert Set Definition
  // -----------------------------------------------------------------------
  describe("upsertSetDefinition", () => {
    it("inserts a new definition with all fields", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", sortOrder: 1 },
        db,
      );

      const def = await upsertSetDefinition(
        {
          id: "set-doa-1st",
          groupUuid: "grp-doa",
          prefix: "DOA 1st",
          name: "DOA 1st Edition",
          language: "EN",
          releaseDate: "2024-01-15",
        },
        db,
      );

      expect(def.id).toBe("set-doa-1st");
      expect(def.groupUuid).toBe("grp-doa");
      expect(def.prefix).toBe("DOA 1st");
      expect(def.name).toBe("DOA 1st Edition");
      expect(def.language).toBe("EN");
      expect(def.releaseDate).toBe("2024-01-15");
    });

    it("defaults language to EN", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", sortOrder: 1 },
        db,
      );

      const def = await upsertSetDefinition(
        { id: "set-pt-br", groupUuid: "grp-doa", prefix: "DOA 1st PT", name: "DOA 1st PT" },
        db,
      );

      expect(def.language).toBe("EN");
    });

    it("updates an existing definition and refreshes updatedAt", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", sortOrder: 1 },
        db,
      );

      const first = await upsertSetDefinition(
        { id: "set-doa-1st", groupUuid: "grp-doa", prefix: "DOA 1st", name: "DOA 1st Edition" },
        db,
      );

      const firstUpdatedAt = first.updatedAt!;

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const updated = await upsertSetDefinition(
        { id: "set-doa-1st", groupUuid: "grp-doa", prefix: "DOA 1st", name: "DOA 1st Revised", language: "PT" },
        db,
      );

      expect(updated.name).toBe("DOA 1st Revised");
      expect(updated.language).toBe("PT");
      expect(updated.updatedAt!.getTime()).toBeGreaterThan(firstUpdatedAt.getTime());
    });
  });

  // -----------------------------------------------------------------------
  // Hidden Set UUIDs
  // -----------------------------------------------------------------------
  describe("hidden set uuids", () => {
    const testUserId = "user_hidden_sets_1";

    beforeEach(async () => {
      await db.insert(usersTable).values({
        id: testUserId,
        name: "Hidden Set Tester",
        email: "hidden-tester@ga.local",
        friendCode: "GA-HIDDEN-TEST",
        locale: "en",
      });
    });

    it("returns empty array for new user (default column value)", async () => {
      const hidden = await getUserHiddenSetUuids(testUserId, db);
      expect(hidden).toEqual([]);
    });

    it("stores and retrieves hidden set uuids", async () => {
      await setUserHiddenSetUuids(testUserId, ["uuid-1", "uuid-2"], db);

      const hidden = await getUserHiddenSetUuids(testUserId, db);
      expect(hidden).toEqual(["uuid-1", "uuid-2"]);
    });

    it("deduplicates stored uuids", async () => {
      await setUserHiddenSetUuids(testUserId, ["uuid-1", "uuid-2", "uuid-1", "uuid-2"], db);

      const hidden = await getUserHiddenSetUuids(testUserId, db);
      expect(hidden).toEqual(["uuid-1", "uuid-2"]);
    });

    it("overwrites previous values", async () => {
      await setUserHiddenSetUuids(testUserId, ["uuid-1", "uuid-2"], db);
      await setUserHiddenSetUuids(testUserId, ["uuid-3"], db);

      const hidden = await getUserHiddenSetUuids(testUserId, db);
      expect(hidden).toEqual(["uuid-3"]);
    });

    it("returns empty array for non-existent user", async () => {
      const hidden = await getUserHiddenSetUuids("non-existent-user", db);
      expect(hidden).toEqual([]);
    });

    it("tolerates malformed JSON and returns empty array", async () => {
      await testDbClient.execute(
        `UPDATE users SET hidden_set_uuids = ? WHERE id = ?`,
        ["{bad json", testUserId],
      );

      const hidden = await getUserHiddenSetUuids(testUserId, db);
      expect(hidden).toEqual([]);
    });

    it("tolerates NULL stored value and returns empty array", async () => {
      const hidden = await getUserHiddenSetUuids(testUserId, db);
      expect(hidden).toEqual([]);
    });

    it("stores an empty array when given empty list", async () => {
      await setUserHiddenSetUuids(testUserId, [], db);

      const hidden = await getUserHiddenSetUuids(testUserId, db);
      expect(hidden).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Cascade / referential integrity
  // -----------------------------------------------------------------------
  describe("cascade behaviour", () => {
    it("cascades group deletion to child definitions", async () => {
      await upsertFeaturedSetGroup(
        { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", sortOrder: 1 },
        db,
      );
      await upsertSetDefinition(
        { id: "set-doa-1st", groupUuid: "grp-doa", prefix: "DOA 1st", name: "DOA 1st" },
        db,
      );

      await db.delete(featuredSetGroups).where(eq(featuredSetGroups.uuid, "grp-doa"));

      const group = await getFeaturedSetGroupByUuid("grp-doa", db);
      expect(group).toBeNull();

      const allGroups = await getAllFeaturedSetGroups(db);
      expect(allGroups).toEqual([]);
    });
  });
});
