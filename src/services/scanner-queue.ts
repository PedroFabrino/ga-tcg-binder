import { eq } from "drizzle-orm";
import { cards, cardEditions, scannerSessions } from "../db/schema";
import type { ScannerCardDetection } from "./scanner";

export interface QueueInput {
  editionId: string;
  foil: boolean;
  confidence: number; // 0..100
}

async function loadSession(token: string, database: any) {
  const session = await database.select().from(scannerSessions).where(eq(scannerSessions.token, token)).get();
  if (!session) throw new Error("Scanner session not found");
  if (session.status !== "active" || new Date(session.expiresAt).getTime() < Date.now()) {
    throw new Error("Scanner session is expired");
  }
  return session;
}

async function savePayload(sessionId: string, detections: ScannerCardDetection[], database: any) {
  await database
    .update(scannerSessions)
    .set({ scannedPayload: JSON.stringify(detections) })
    .where(eq(scannerSessions.id, sessionId));
}

/** Append a phone-identified card (with chosen variant) to the paired session queue. */
export async function queueIdentifiedCard(
  token: string,
  input: QueueInput,
  database: any
): Promise<ScannerCardDetection & { timestamp: number }> {
  const session = await loadSession(token, database);
  const row = await database
    .select({
      editionId: cardEditions.id,
      cardSlug: cardEditions.cardSlug,
      cardName: cards.name,
      setPrefix: cardEditions.setPrefix,
      collectorNumber: cardEditions.collectorNumber,
    })
    .from(cardEditions)
    .innerJoin(cards, eq(cardEditions.cardSlug, cards.slug))
    .where(eq(cardEditions.id, input.editionId))
    .get();
  if (!row) throw new Error("Unknown edition");

  const detections: ScannerCardDetection[] = JSON.parse(session.scannedPayload || "[]");
  const detection = {
    rawText: `${row.setPrefix} ${row.collectorNumber}`,
    cardSlug: row.cardSlug,
    cardName: row.cardName,
    editionId: row.editionId,
    setPrefix: row.setPrefix,
    collectorNumber: row.collectorNumber,
    confidence: input.confidence / 100,
    timestamp: Date.now(),
    foil: input.foil,
  };
  await savePayload(session.id, [...detections, detection], database);
  return detection;
}

export type QueueUpdate = { foil: boolean } | { remove: true };

/** Change variant or undo a queued (not yet confirmed) card, addressed by its timestamp key. */
export async function updateQueuedCard(token: string, timestamp: number, update: QueueUpdate, database: any) {
  const session = await loadSession(token, database);
  const detections: ScannerCardDetection[] = JSON.parse(session.scannedPayload || "[]");
  const next = detections
    .map((d) => (d.timestamp === timestamp && !d.confirmed && "foil" in update ? { ...d, foil: update.foil } : d))
    .filter((d) => !(d.timestamp === timestamp && !d.confirmed && "remove" in update));
  await savePayload(session.id, next, database);
}
