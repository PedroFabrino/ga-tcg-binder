import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../db/test-utils";
import { users, cards, cardEditions, collectionItems } from "../db/schema";
import {
  createScannerSession,
  getScannerSession,
  submitScannerDetections,
  confirmScannedCardsToCollection,
} from "./scanner";

describe("QR-Paired Mobile Scanner Seam", () => {
  it("creates a paired session, submits OCR camera detections, and confirms into collection", async () => {
    const { db } = await createTestDb();

    await db.insert(users).values({
      id: "u-scanner",
      name: "Desktop Collector",
      friendCode: "GA-SCANNER",
      lowPopThreshold: 1000,
    });

    await db.insert(cards).values({
      slug: "fracturize",
      name: "Fracturize",
      element: "NORM",
      class: "WARRIOR",
      type: "ACTION",
      subtypes: "[]",
    });

    await db.insert(cardEditions).values({
      id: "ed-frac-doa",
      cardSlug: "fracturize",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "001",
      rarity: 3,
      imageUrl: "https://example.com/frac.jpg",
    });

    // 1. Desktop generates scanner session
    const session = await createScannerSession("u-scanner", "https://app.gatcg.local", db);
    expect(session.token).toBeDefined();
    expect(session.qrCodeDataUrl).toContain("data:image/png;base64,");

    // 2. Mobile submits camera OCR detection using collector code "DOA 001"
    const detections = await submitScannerDetections(session.token, ["DOA 001", "Unknown Card 999"], db);
    expect(detections).toHaveLength(2);
    expect(detections[0].cardName).toBe("Fracturize");
    expect(detections[0].cardSlug).toBe("fracturize");
    expect(detections[0].editionId).toBe("ed-frac-doa");
    expect(detections[0].confidence).toBe(0.95);

    // 3. Desktop fetches live session status (unrecognized items are NOT saved to live queue)
    const liveSession = await getScannerSession(session.token, db);
    expect(liveSession?.detections).toHaveLength(1);
    expect(liveSession?.detections[0].cardName).toBe("Fracturize");

    // 4. Desktop confirms card into collection
    const confirmedCount = await confirmScannedCardsToCollection(session.token, [0], db);
    expect(confirmedCount).toBe(1);

    // Verify item is in user collection
    const coll = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.userId, "u-scanner"));
    expect(coll).toHaveLength(1);
    expect(coll[0].editionId).toBe("ed-frac-doa");
    // Verify non-Grand Archive cards (e.g. "Unknown Junk") are rejected with 0 confidence and NOT stored
    const rejected = await submitScannerDetections(session.token, ["Unknown Non Card"], db);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].cardName).toBe("Unknown Non Card");
    expect(rejected[0].cardSlug).toBeUndefined();
    expect(rejected[0].editionId).toBeUndefined();
    expect(rejected[0].confidence).toBe(0);

    const liveAfterReject = await getScannerSession(session.token, db);
    expect(liveAfterReject?.detections).toHaveLength(1); // Still 1, junk was not added!

    // Verify fuzzy OCR matching (minor typo "Fracturze" -> "Fracturize")
    const fuzzy = await submitScannerDetections(session.token, ["Fracturze"], db);
    expect(fuzzy).toHaveLength(1);
    expect(fuzzy[0].cardSlug).toBe("fracturize");
    expect(fuzzy[0].cardName).toBe("Fracturize");
    expect(fuzzy[0].confidence).toBeGreaterThanOrEqual(0.85);

    // Verify Grand Archive format with language code and separator: "DOA » EN-001 C"
    const gaFormat = await submitScannerDetections(session.token, ["DOA » EN-001 C » illust: Test"], db);
    expect(gaFormat).toHaveLength(1);
    expect(gaFormat[0].cardSlug).toBe("fracturize");
    expect(gaFormat[0].editionId).toBe("ed-frac-doa");
    expect(gaFormat[0].confidence).toBe(0.95);
  });
});
