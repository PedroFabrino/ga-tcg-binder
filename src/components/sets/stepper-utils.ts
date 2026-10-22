/**
 * Pure request builder for the collection update stepper.
 * Takes a card's preferredEditionId, current owned quantity, and a delta
 * (+1 or -1), returns the POST body for /api/collection, or null if
 * the update is impossible (no editionId or already at 0 with -1 delta).
 */
export function buildCollectionUpdateRequest(
  preferredEditionId: string | null,
  currentQuantity: number,
  delta: number,
): { editionId: string; foil: false; quantity: number } | null {
  if (!preferredEditionId) return null;
  const next = Math.max(0, currentQuantity + delta);
  if (next === currentQuantity) return null;
  return { editionId: preferredEditionId, foil: false as const, quantity: next };
}