import QRCode from "qrcode";
import { eq, and, gt, sql } from "drizzle-orm";
import { scannerSessions, cards, cardEditions, collectionItems } from "../db/schema";
import { addOrUpdateCollectionItem } from "./collection";

export interface ScannerCardDetection {
  rawText: string;
  cardSlug?: string;
  cardName?: string;
  editionId?: string;
  setPrefix?: string;
  collectorNumber?: string;
  confidence: number;
  timestamp: number;
  confirmed?: boolean;
}

export interface ScannerSessionInfo {
  id: string;
  token: string;
  status: string;
  expiresAt: Date;
  qrCodeDataUrl: string;
  pairingUrl: string;
  detections: ScannerCardDetection[];
}

export async function createScannerSession(
  userId: string,
  baseUrl: string,
  database: any
): Promise<ScannerSessionInfo> {
  const token = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await database.insert(scannerSessions).values({
    id,
    userId,
    token,
    status: "active",
    expiresAt,
    scannedPayload: "[]",
  });

  const pairingUrl = `${baseUrl}/scan/${token}`;
  const qrCodeDataUrl = await QRCode.toDataURL(pairingUrl, {
    width: 280,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return {
    id,
    token,
    status: "active",
    expiresAt,
    qrCodeDataUrl,
    pairingUrl,
    detections: [],
  };
}

export async function getScannerSession(
  token: string,
  database: any
): Promise<ScannerSessionInfo | null> {
  const session = await database
    .select()
    .from(scannerSessions)
    .where(eq(scannerSessions.token, token))
    .get();

  if (!session) return null;

  const isExpired = new Date(session.expiresAt).getTime() < Date.now();
  const status = isExpired ? "expired" : session.status;

  const detections: ScannerCardDetection[] = JSON.parse(session.scannedPayload || "[]");

  return {
    id: session.id,
    token: session.token,
    status,
    expiresAt: new Date(session.expiresAt),
    qrCodeDataUrl: "",
    pairingUrl: `/scan/${token}`,
    detections,
  };
}

export async function submitScannerDetections(
  token: string,
  rawTexts: string[],
  database: any
): Promise<ScannerCardDetection[]> {
  const session = await database
    .select()
    .from(scannerSessions)
    .where(and(eq(scannerSessions.token, token), eq(scannerSessions.status, "active")))
    .get();

  if (!session) {
    throw new Error("Invalid or expired scanner session");
  }

  const existingDetections: ScannerCardDetection[] = JSON.parse(session.scannedPayload || "[]");
  const newDetections: ScannerCardDetection[] = [];

  for (const raw of rawTexts) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Check collector number format e.g. "DOA 001", "DOA-001", "P24 000"
    const codeMatch = trimmed.match(/([A-Za-z0-9]{2,4})[\s\-]+(\d{3})/);
    let matchedEdition = null;
    let matchedCard = null;

    if (codeMatch) {
      const setPrefix = codeMatch[1].toUpperCase();
      const collectorNumber = codeMatch[2];

      matchedEdition = await database
        .select()
        .from(cardEditions)
        .where(
          and(
            sql`upper(${cardEditions.setPrefix}) = ${setPrefix}`,
            eq(cardEditions.collectorNumber, collectorNumber)
          )
        )
        .get();

      if (matchedEdition) {
        matchedCard = await database
          .select()
          .from(cards)
          .where(eq(cards.slug, matchedEdition.cardSlug))
          .get();
      }
    }

    // If no match by code, match by card name
    if (!matchedCard) {
      matchedCard = await database
        .select()
        .from(cards)
        .where(sql`lower(${cards.name}) = lower(${trimmed})`)
        .get();

      if (matchedCard) {
        const eds = await database
          .select()
          .from(cardEditions)
          .where(eq(cardEditions.cardSlug, matchedCard.slug));
        matchedEdition = eds[0] || null;
      }
    }

    const detection: ScannerCardDetection = {
      rawText: trimmed,
      cardSlug: matchedCard?.slug,
      cardName: matchedCard?.name || trimmed,
      editionId: matchedEdition?.id,
      setPrefix: matchedEdition?.setPrefix,
      collectorNumber: matchedEdition?.collectorNumber,
      confidence: matchedCard ? 0.95 : 0.4,
      timestamp: Date.now(),
      confirmed: false,
    };

    newDetections.push(detection);
  }

  const updatedPayload = [...existingDetections, ...newDetections];
  await database
    .update(scannerSessions)
    .set({
      scannedPayload: JSON.stringify(updatedPayload),
    })
    .where(eq(scannerSessions.id, session.id));

  return newDetections;
}

export async function confirmScannedCardsToCollection(
  token: string,
  selectedIndices: number[],
  database: any
): Promise<number> {
  const session = await database
    .select()
    .from(scannerSessions)
    .where(eq(scannerSessions.token, token))
    .get();

  if (!session) {
    throw new Error("Scanner session not found");
  }

  const detections: ScannerCardDetection[] = JSON.parse(session.scannedPayload || "[]");
  let confirmedCount = 0;

  for (const idx of selectedIndices) {
    if (idx >= 0 && idx < detections.length) {
      const item = detections[idx];
      if (item.editionId && !item.confirmed) {
        await addOrUpdateCollectionItem(
          {
            userId: session.userId,
            editionId: item.editionId,
            foil: false,
            quantity: 1,
          },
          database
        );
        item.confirmed = true;
        confirmedCount++;
      }
    }
  }

  await database
    .update(scannerSessions)
    .set({
      scannedPayload: JSON.stringify(detections),
    })
    .where(eq(scannerSessions.id, session.id));

  return confirmedCount;
}
