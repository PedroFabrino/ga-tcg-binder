import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { users, cards, cardEditions, collectionItems } from "../db/schema";
import { createScannerSession, confirmScannedCardsToCollection, getScannerSession } from "./scanner";
import { queueIdentifiedCard, updateQueuedCard } from "./scanner-queue";

async function setup() {
  const { db } = await createTestDb();
  await db.insert(users).values({ id: "u1", name: "U", friendCode: "GA-Q", lowPopThreshold: 1000 });
  await db.insert(cards).values({ slug: "frac", name: "Fracturize", element: "NORM", class: "WARRIOR", type: "ACTION", subtypes: "[]" });
  await db.insert(cardEditions).values({
    id: "ed1", cardSlug: "frac", setPrefix: "DOA", setName: "Dawn of Ashes", collectorNumber: "001", rarity: 1, imageUrl: "https://x/f.jpg",
  });
  const session = await createScannerSession("u1", "https://app", db);
  return { db, token: session.token };
}

describe("scanner queue", () => {
  it("queues an identified card with variant and confirms it as foil", async () => {
    const { db, token } = await setup();
    const q = await queueIdentifiedCard(token, { editionId: "ed1", foil: true, confidence: 95 }, db);
    expect(q.cardName).toBe("Fracturize");

    const session = await getScannerSession(token, db);
    expect(session!.detections).toHaveLength(1);
    expect(session!.detections[0]).toMatchObject({ editionId: "ed1", foil: true });

    await confirmScannedCardsToCollection(token, [0], db);
    const items = await db.select().from(collectionItems);
    expect(items[0]).toMatchObject({ editionId: "ed1", foil: true });
  });

  it("changes variant and undoes by timestamp key", async () => {
    const { db, token } = await setup();
    const q = await queueIdentifiedCard(token, { editionId: "ed1", foil: false, confidence: 91 }, db);
    await updateQueuedCard(token, q.timestamp, { foil: true }, db);
    expect((await getScannerSession(token, db))!.detections[0].foil).toBe(true);

    await updateQueuedCard(token, q.timestamp, { remove: true }, db);
    expect((await getScannerSession(token, db))!.detections).toHaveLength(0);
  });

  it("rejects unknown editions and does not remove confirmed entries", async () => {
    const { db, token } = await setup();
    await expect(queueIdentifiedCard(token, { editionId: "nope", foil: false, confidence: 99 }, db)).rejects.toThrow();
    const q = await queueIdentifiedCard(token, { editionId: "ed1", foil: false, confidence: 99 }, db);
    await confirmScannedCardsToCollection(token, [0], db);
    await updateQueuedCard(token, q.timestamp, { remove: true }, db);
    expect((await getScannerSession(token, db))!.detections).toHaveLength(1);
  });
});
