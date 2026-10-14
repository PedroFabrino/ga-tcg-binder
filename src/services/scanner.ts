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
  foil?: boolean;
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

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

export function normalizeCardText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

    let matchedEdition: any = null;
    let matchedCard: any = null;
    let confidence = 0;

    // 1. Check for collector number pattern e.g. "RDO » EN-250 C", "DOA » EN-001", "DOA 001", "DOA 1st 001", "ALC 042", "P24 000"
    const codeMatch = trimmed.match(
      /(?:^|\b)([A-Za-z0-9]{2,6}(?:[\s\-_]+(?:1st|alter|sd|dp|evp|p))?)\s*(?:[»\-\.:·|~]\s*)?(?:(?:EN|FR|DE|JP|KR|CN|TC)[\s\-_»\.]+)?\s*(\d{3})(?:\b|$)/i
    );

    if (codeMatch) {
      const basePrefix = codeMatch[1].trim().toUpperCase();
      const collectorNumber = codeMatch[2];

      matchedEdition = await database
        .select()
        .from(cardEditions)
        .where(
          and(
            sql`upper(${cardEditions.setPrefix}) = ${basePrefix}`,
            eq(cardEditions.collectorNumber, collectorNumber)
          )
        )
        .get();

      if (!matchedEdition) {
        // Prefix startsWith fallback (e.g. 'DOA' matches 'DOA 1st' or 'DOA Alter')
        matchedEdition = await database
          .select()
          .from(cardEditions)
          .where(
            and(
              sql`upper(${cardEditions.setPrefix}) LIKE ${basePrefix + "%"}`,
              eq(cardEditions.collectorNumber, collectorNumber)
            )
          )
          .get();
      }

      if (matchedEdition) {
        matchedCard = await database
          .select()
          .from(cards)
          .where(eq(cards.slug, matchedEdition.cardSlug))
          .get();

        if (matchedCard) {
          confidence = 0.95;
        }
      }
    }

    // 2. If no match by code, match by card name
    if (!matchedCard) {
      // 2a. Direct exact match
      matchedCard = await database
        .select()
        .from(cards)
        .where(sql`lower(${cards.name}) = lower(${trimmed})`)
        .get();

      if (matchedCard) {
        confidence = 0.95;
      }
    }

    // 2b. Line-by-line exact match (if multi-line OCR text)
    if (!matchedCard && trimmed.includes("\n")) {
      const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length >= 3);
      for (const line of lines) {
        const found = await database
          .select()
          .from(cards)
          .where(sql`lower(${cards.name}) = lower(${line})`)
          .get();

        if (found) {
          matchedCard = found;
          confidence = 0.92;
          break;
        }
      }
    }

    // 2c. Normalized / fuzzy match against card names
    if (!matchedCard) {
      const normInput = normalizeCardText(trimmed);
      if (normInput.length >= 4) {
        // Query candidate cards that could match
        const candidates = await database
          .select({ slug: cards.slug, name: cards.name })
          .from(cards)
          .all();

        let bestCard: any = null;
        let bestSim = 0;

        for (const cand of candidates) {
          const normCand = normalizeCardText(cand.name);
          if (normCand === normInput) {
            bestCard = cand;
            bestSim = 0.95;
            break;
          }

          // Check if input contains candidate name or vice-versa
          if (normInput.includes(normCand) && normCand.length >= 4) {
            const sim = normCand.length / normInput.length;
            if (sim > 0.6 && sim > bestSim) {
              bestCard = cand;
              bestSim = 0.90;
            }
          }

          // Levenshtein similarity for OCR typos
          if (Math.abs(normCand.length - normInput.length) <= 3) {
            const sim = stringSimilarity(normCand, normInput);
            if (sim >= 0.82 && sim > bestSim) {
              bestSim = sim;
              bestCard = cand;
            }
          }
        }

        if (bestCard && bestSim >= 0.82) {
          matchedCard = await database
            .select()
            .from(cards)
            .where(eq(cards.slug, bestCard.slug))
            .get();
          confidence = Math.round(bestSim * 100) / 100;
        }
      }
    }

    // If card was matched but edition wasn't, find primary edition
    if (matchedCard && !matchedEdition) {
      const eds = await database
        .select()
        .from(cardEditions)
        .where(eq(cardEditions.cardSlug, matchedCard.slug));
      matchedEdition = eds[0] || null;
    }

    const detection: ScannerCardDetection = {
      rawText: trimmed,
      cardSlug: matchedCard?.slug,
      cardName: matchedCard?.name || trimmed,
      editionId: matchedEdition?.id,
      setPrefix: matchedEdition?.setPrefix,
      collectorNumber: matchedEdition?.collectorNumber,
      confidence: matchedCard ? confidence : 0,
      timestamp: Date.now(),
      confirmed: false,
    };

    newDetections.push(detection);
  }

  // ONLY persist valid recognized cards (with editionId and confidence >= 0.7) to the session queue
  const validNewDetections = newDetections.filter(
    (d) => d.editionId && d.confidence >= 0.7
  );

  if (validNewDetections.length > 0) {
    // Avoid immediate duplicate entries of the exact same edition within the last 15 seconds
    const filteredToAdd = validNewDetections.filter((d) => {
      const alreadyPending = existingDetections.some(
        (existing) =>
          existing.editionId === d.editionId &&
          !existing.confirmed &&
          Math.abs(existing.timestamp - d.timestamp) < 15000
      );
      return !alreadyPending;
    });

    if (filteredToAdd.length > 0) {
      const updatedPayload = [...existingDetections, ...filteredToAdd];
      await database
        .update(scannerSessions)
        .set({
          scannedPayload: JSON.stringify(updatedPayload),
        })
        .where(eq(scannerSessions.id, session.id));
    }
  }

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
            foil: item.foil ?? false,
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
