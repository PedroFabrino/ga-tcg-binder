import type { CollectionItem } from "@/components/collection/types";

export interface OmnidexExportOptions {
  includePrintings?: boolean;
}

/**
 * Serializes collection cards into standard Omnidex / Grand Archive text import format.
 * Format: 4x Fracturize [DOA 001 Foil] or 4x Fracturize
 */
export function exportCollectionToOmnidex(
  items: CollectionItem[],
  options: OmnidexExportOptions = { includePrintings: true }
): string {
  const lines: string[] = [];

  for (const item of items) {
    if (item.quantity <= 0) continue;
    if (options.includePrintings && item.setPrefix) {
      const foilSuffix = item.foil ? " Foil" : "";
      const collectorPart = item.collectorNumber ? ` ${item.collectorNumber}` : "";
      lines.push(`${item.quantity}x ${item.cardName} [${item.setPrefix}${collectorPart}${foilSuffix}]`);
    } else {
      const foilSuffix = item.foil ? " (Foil)" : "";
      lines.push(`${item.quantity}x ${item.cardName}${foilSuffix}`);
    }
  }

  return lines.join("\n");
}

function escapeCsvField(val: string | number | boolean | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serializes collection items into an RFC-4180 compliant CSV spreadsheet format.
 */
export function exportCollectionToCsv(items: CollectionItem[]): string {
  const headers = [
    "Card Name",
    "Quantity",
    "Finish",
    "Set Code",
    "Set Name",
    "Collector Number",
    "Rarity",
    "Element",
    "Class",
    "Type",
    "Dedicated",
    "Edition ID",
  ];

  const rows = items
    .filter((i) => i.quantity > 0)
    .map((item) =>
      [
        escapeCsvField(item.cardName),
        item.quantity,
        item.foil ? "Foil" : "Normal",
        escapeCsvField(item.setPrefix),
        escapeCsvField(item.setName),
        escapeCsvField(item.collectorNumber),
        item.rarity,
        escapeCsvField(item.element),
        escapeCsvField(item.class),
        escapeCsvField(item.type),
        item.isDedicated ? "Yes" : "No",
        escapeCsvField(item.editionId),
      ].join(",")
    );

  return [headers.join(","), ...rows].join("\r\n");
}

/**
 * Triggers a client-side file download with the given content, filename, and MIME type.
 */
export function downloadExportFile(content: string, filename: string, mimeType: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
