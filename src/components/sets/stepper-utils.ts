/**
 * Pure request builder for the collection update stepper.
 *
 * `addOrUpdateCollectionItem` treats `quantity` as a DELTA
 * (existing.quantity + params.quantity), so this must return the delta ±1,
 * NOT an absolute count.
 *
 * Returns null when the update is impossible (no editionId, or delta would
 * take normal copies below 0).
 */
export function buildCollectionUpdateRequest(
  preferredEditionId: string | null,
  ownedNormal: number,
  delta: number,
): { editionId: string; foil: false; quantity: number } | null {
  if (!preferredEditionId) return null;
  // Clamp: never decrement normal copies below 0
  if (delta < 0 && ownedNormal + delta < 0) return null;
  // No-op: delta is 0
  if (delta === 0) return null;
  return { editionId: preferredEditionId, foil: false as const, quantity: delta };
}