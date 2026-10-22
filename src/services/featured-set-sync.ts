import {
  upsertFeaturedSetGroup,
  upsertSetDefinition,
  getAllFeaturedSetGroups,
} from "@/db/repositories/set-repository";
import type { SetRepositoryDatabase } from "@/db/repositories/set-repository";
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
// Validation (hand-rolled per ADR 0012 — no zod)
// ---------------------------------------------------------------------------

interface ValidationError {
  path: string;
  message: string;
}

function validateGroup(data: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    errors.push({
      path: `groups[${index}]`,
      message: `Expected object, got ${typeof data}`,
    });
    return errors;
  }
  const g = data as Record<string, unknown>;

  if (typeof g.uuid !== "string" || !g.uuid) {
    errors.push({
      path: `groups[${index}].uuid`,
      message: "uuid must be a non-empty string",
    });
  }
  if (typeof g.name !== "string" || !g.name) {
    errors.push({
      path: `groups[${index}].name`,
      message: "name must be a non-empty string",
    });
  }
  if (g.image !== undefined && typeof g.image !== "string") {
    errors.push({
      path: `groups[${index}].image`,
      message: "image must be a string when present",
    });
  }
  if (!Array.isArray(g.sets)) {
    errors.push({
      path: `groups[${index}].sets`,
      message: "sets must be an array",
    });
    return errors;
  }

  const sets = g.sets as unknown[];
  for (let j = 0; j < sets.length; j++) {
    const s = sets[j];
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      errors.push({
        path: `groups[${index}].sets[${j}]`,
        message: `Expected object, got ${typeof s}`,
      });
      continue;
    }
    const set = s as Record<string, unknown>;
    if (typeof set.id !== "string" || !set.id) {
      errors.push({
        path: `groups[${index}].sets[${j}].id`,
        message: "set id must be a non-empty string",
      });
    }
    if (typeof set.name !== "string" || !set.name) {
      errors.push({
        path: `groups[${index}].sets[${j}].name`,
        message: "set name must be a non-empty string",
      });
    }
    if (typeof set.prefix !== "string" || !set.prefix) {
      errors.push({
        path: `groups[${index}].sets[${j}].prefix`,
        message: "set prefix must be a non-empty string",
      });
    }
  }

  return errors;
}

function parseGroupsPayload(raw: unknown): {
  success: true;
  data: GatcgApiFeaturedGroup[];
} | {
  success: false;
  errors: ValidationError[];
} {
  if (!Array.isArray(raw)) {
    return {
      success: false,
      errors: [{ path: "root", message: "Expected an array of groups" }],
    };
  }

  const allErrors: ValidationError[] = [];
  for (let i = 0; i < raw.length; i++) {
    allErrors.push(...validateGroup(raw[i], i));
  }

  if (allErrors.length > 0) {
    return { success: false, errors: allErrors };
  }

  return { success: true, data: raw as GatcgApiFeaturedGroup[] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic ASCII slug from a display name:
 * "Dawn of Ashes" → "dawn-of-ashes"
 * ".asphodel/paradise" → "asphodel-paradise"
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
  targetDb?: SetRepositoryDatabase,
  fetchImpl: typeof fetch = fetch,
): Promise<
  Pick<SyncStats, "featuredSetGroupsSynced" | "setDefinitionsSynced">
> {
  const response = await fetchImpl("https://api.gatcg.com/featured-sets");
  if (!response.ok) {
    throw new Error(
      `Failed to fetch featured sets from api.gatcg.com: ${response.statusText}`,
    );
  }

  const raw = await response.json();
  const parsed = parseGroupsPayload(raw);
  if (!parsed.success) {
    const details = parsed.errors
      .map((e) => `${e.path}: ${e.message}`)
      .join("; ");
    throw new Error(
      `Malformed featured-sets payload from api.gatcg.com: ${details}`,
    );
  }
  const groupsData = parsed.data;

  // Build collision map: slug → uuid for existing rows
  const existingGroups = await getAllFeaturedSetGroups(targetDb);
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
    const currentSlug = existingGroups.find(
      (g) => g.uuid === group.uuid,
    )?.slug;
    if (currentSlug && currentSlug !== slug) {
      taken.delete(currentSlug);
    }
    taken.set(slug, group.uuid);

    const imageUrl = group.image
      ? group.image.startsWith("http")
        ? group.image
        : `https://api.gatcg.com${group.image}`
      : "";

    await upsertFeaturedSetGroup(
      { uuid: group.uuid, name: group.name, slug, imageUrl, sortOrder: i },
      targetDb,
    );
    groupsSynced++;

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
        targetDb,
      );
      definitionsSynced++;
    }
  }

  return { featuredSetGroupsSynced: groupsSynced, setDefinitionsSynced: definitionsSynced };
}