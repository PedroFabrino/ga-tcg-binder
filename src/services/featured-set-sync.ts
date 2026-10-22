import {
  upsertFeaturedSetGroup,
  upsertSetDefinition,
  getAllFeaturedSetGroups,
} from "@/db/repositories/set-repository";
import type { SyncStats } from "./catalog-sync";

// ---------------------------------------------------------------------------
// API shape (mirrors https://api.gatcg.com/featured-sets)
// ---------------------------------------------------------------------------

export interface GatcgApiFeaturedSet {
  id: string;
  name: string;
  prefix: string;
  language?: string;
  release_date?: string | null;
}

export interface GatcgApiFeaturedGroup {
  uuid: string;
  name: string;
  image?: string;
  sets: GatcgApiFeaturedSet[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic ASCII slug from a display name:
 *   "Dawn of Ashes"      → "dawn-of-ashes"
 *   ".asphodel/paradise" → "asphodel-paradise"
 */
function toAsciiSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "set"
  );
}

/** Extract YYYY-MM-DD from an ISO datetime or date string. */
function normalizeReleaseDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches https://api.gatcg.com/featured-sets and upserts every group and
 * child set definition into the local DB.
 *
 * Accepts an injectable `fetchImpl` so tests never hit the network.
 * A non-ok response throws immediately (no silent skip).
 */
export async function syncFeaturedSetsFromApi(
  targetDb?: any,
  fetchImpl: typeof fetch = fetch,
): Promise<Pick<SyncStats, "featuredSetGroupsSynced" | "setDefinitionsSynced">> {
  const database = targetDb;
  const response = await fetchImpl("https://api.gatcg.com/featured-sets");
  if (!response.ok) {
    throw new Error(
      `Failed to fetch featured sets from api.gatcg.com: ${response.statusText}`,
    );
  }

  const groupsData: GatcgApiFeaturedGroup[] = await response.json();

  // Build collision map: slug → uuid for existing rows
  const existingGroups = await getAllFeaturedSetGroups(database);
  const taken = new Map<string, string>(); // slug → uuid
  for (const g of existingGroups) {
    taken.set(g.slug, g.uuid);
  }

  let groupsSynced = 0;
  let definitionsSynced = 0;

  for (let i = 0; i < groupsData.length; i++) {
    const group = groupsData[i];

    // ── Slug with uniqueness guarantee ──
    const base = toAsciiSlug(group.name);
    let slug = base;
    let suffix = 2;
    // A group may keep the slug it currently owns in the DB.
    while (taken.has(slug) && taken.get(slug) !== group.uuid) {
      slug = `${base}-${suffix++}`;
    }
    // Release the group's previous slug so it becomes available.
    const currentSlug = existingGroups.find((g) => g.uuid === group.uuid)?.slug;
    if (currentSlug && currentSlug !== slug) {
      taken.delete(currentSlug);
    }
    taken.set(slug, group.uuid);

    // ── Image URL expansion ──
    const imageUrl = group.image
      ? group.image.startsWith("http")
        ? group.image
        : `https://api.gatcg.com${group.image}`
      : "";

    await upsertFeaturedSetGroup(
      { uuid: group.uuid, name: group.name, slug, imageUrl, sortOrder: i },
      database,
    );
    groupsSynced++;

    // ── Child definitions ──
    for (const setDef of group.sets) {
      await upsertSetDefinition(
        {
          id: setDef.id,
          groupUuid: group.uuid,
          prefix: setDef.prefix,
          name: setDef.name,
          language: setDef.language ?? "EN",
          releaseDate: normalizeReleaseDate(setDef.release_date),
        },
        database,
      );
      definitionsSynced++;
    }
  }

  return {
    featuredSetGroupsSynced: groupsSynced,
    setDefinitionsSynced: definitionsSynced,
  };
}