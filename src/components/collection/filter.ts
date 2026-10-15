import type { CollectionItem } from "./types";

/**
 * Filters a list of CollectionItem objects by a partial query string.
 * Matches against card name, set prefix, collector number, and combo strings (e.g. "DOA #001", "DOA 001").
 */
export function filterCollectionItems(items: CollectionItem[], query: string): CollectionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    const name = (item.cardName || "").toLowerCase();
    const prefix = (item.setPrefix || "").toLowerCase();
    const number = (item.collectorNumber || "").toLowerCase();
    const comboWithHash = `${prefix} #${number}`;
    const comboPlain = `${prefix} ${number}`;

    return (
      name.includes(q) ||
      prefix.includes(q) ||
      number.includes(q) ||
      comboWithHash.includes(q) ||
      comboPlain.includes(q)
    );
  });
}
