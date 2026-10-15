/** Grand Archive printings come in exactly two finishes. */
export type Finish = "Normal" | "Foil";

export type ElementKey = "NORM" | "FIRE" | "WATER" | "WIND" | "EARTH" | "LUXEM" | "UMBRA";

export type SetPrefix = "DOA" | "FTC" | "ALC" | "MRC" | "P24" | (string & {});

export interface Edition {
  id: string;
  cardSlug: string;
  setPrefix: SetPrefix;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string | null;
  foilAvailable: boolean;
}

export interface Card {
  slug: string;
  name: string;
  element: ElementKey;
  cardClass: string;
  type: string;
  editions: Edition[];
}

/** Mirrors `CardMatchResult` in @ga/contracts. */
export interface MatchResult {
  editionId: string;
  cardSlug: string;
  cardName: string;
  element: ElementKey;
  setPrefix: SetPrefix;
  collectorNumber: string;
  imageUrl: string | null;
  /** Composite certainty 0..100. */
  confidence: number;
  sVisual: number;
  sOcr: number | null;
  signals: { collectorMatch: boolean; ocrFallback: boolean };
}

export type DeliveryStatus = "sending" | "sent" | "failed";

export interface ScannedCard {
  id: string;
  match: MatchResult;
  finish: Finish;
  scannedAt: number;
  status: DeliveryStatus;
}

export const RAPID_FIRE_CERTAINTY = 90;
export const RAPID_FIRE_WINDOW_MS = 1200;

/** Collector numbers may already embed the set prefix (e.g. "DOA-001"); strip it for display. */
export function collectorDigits(setPrefix: string, collectorNumber: string): string {
  return collectorNumber.replace(new RegExp(`^${setPrefix}[-\\s]?`, "i"), "");
}
