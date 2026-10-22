import type { SetChecklistFilterStatus, SetChecklistFilters } from "@ga/contracts";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Hide Body
// ---------------------------------------------------------------------------

export interface SetHideBody {
  groupUuid: string;
  isHidden: boolean;
}

/**
 * Validates the `POST /api/sets/hide` request body.
 * Requires a non-empty `groupUuid` string and a boolean `isHidden`.
 */
export function parseSetHideBody(raw: unknown): ValidationResult<SetHideBody> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Request body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.groupUuid !== "string" || body.groupUuid.trim() === "") {
    return { success: false, error: "groupUuid must be a non-empty string" };
  }
  if (typeof body.isHidden !== "boolean") {
    return { success: false, error: "isHidden must be a boolean" };
  }

  return {
    success: true,
    data: { groupUuid: body.groupUuid.trim(), isHidden: body.isHidden },
  };
}

// ---------------------------------------------------------------------------
// Checklist Query
// ---------------------------------------------------------------------------

const CHECKLIST_STATUSES: readonly SetChecklistFilterStatus[] = [
  "all",
  "shortages",
  "owned",
  "unowned",
];

function trimmedOrNull(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseChecklistStatus(value: string | null): SetChecklistFilterStatus {
  if (value !== null && (CHECKLIST_STATUSES as readonly string[]).includes(value)) {
    return value as SetChecklistFilterStatus;
  }
  return "all";
}

function parseRarityOrNull(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parses `GET /api/sets/[groupSlug]` query parameters into a
 * {@link SetChecklistFilters}. Unknown values are ignored safely: invalid
 * statuses fall back to "all", non-numeric rarity falls back to null, and
 * blank strings are normalized to null.
 */
export function parseSetChecklistQuery(params: URLSearchParams): SetChecklistFilters {
  return {
    prefix: trimmedOrNull(params.get("prefix")),
    status: parseChecklistStatus(params.get("status")),
    element: trimmedOrNull(params.get("element")),
    rarity: parseRarityOrNull(params.get("rarity")),
    search: trimmedOrNull(params.get("search")),
  };
}