import { type DeckSection, isDeckSection } from "@ga/contracts";

export interface ValidatedReorderItem {
  id: string;
  section: DeckSection;
  position: number;
}

export interface ValidatedReorderRequest {
  items: ValidatedReorderItem[];
}

export type ParseReorderResult =
  | { success: true; data: ValidatedReorderRequest }
  | { success: false; error: string };

const MAX_REORDER_ITEMS = 500;

export function parseReorderRequest(input: unknown): ParseReorderResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, error: "Request body must be a JSON object" };
  }

  const raw = input as Record<string, unknown>;
  const rawItems = raw.items;

  if (!Array.isArray(rawItems)) {
    return { success: false, error: "Field 'items' must be an array" };
  }

  if (rawItems.length === 0) {
    return { success: false, error: "Field 'items' must not be empty" };
  }

  if (rawItems.length > MAX_REORDER_ITEMS) {
    return { success: false, error: `Field 'items' exceeds maximum allowed (${MAX_REORDER_ITEMS})` };
  }

  const items: ValidatedReorderItem[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { success: false, error: `Item at index ${i} must be an object` };
    }

    const it = item as Record<string, unknown>;

    if (typeof it.id !== "string" || !it.id.trim()) {
      return { success: false, error: `Item at index ${i} must have a non-empty string 'id'` };
    }

    const id = it.id.trim();
    if (seenIds.has(id)) {
      return { success: false, error: `Duplicate deck id '${id}' found in items` };
    }
    seenIds.add(id);

    if (!isDeckSection(it.section)) {
      return { success: false, error: `Item '${id}' has invalid section '${String(it.section)}'. Must be 'competitive' or '4fun'` };
    }

    // Support either position or priority field from client
    const rawPos = it.position !== undefined ? it.position : it.priority;
    if (typeof rawPos !== "number" || !Number.isFinite(rawPos) || rawPos < 0) {
      return { success: false, error: `Item '${id}' must have a non-negative integer position` };
    }

    items.push({
      id,
      section: it.section,
      position: Math.floor(rawPos),
    });
  }

  return { success: true, data: { items } };
}
