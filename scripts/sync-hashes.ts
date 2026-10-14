import { eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import { db } from "../src/db";
import { runMigrations } from "../src/db/init";
import { cardEditions, cardHashes } from "../src/db/schema";
import { CARD_H, CARD_W } from "../src/lib/scanner/contracts";
import { dHash } from "../src/lib/scanner/phash";

const CONCURRENCY = 6;

/** Download an edition image, normalise it to 630x880, and return its dHash. Pixels are not stored. */
async function hashImage(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(CARD_W, CARD_H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gray = new Uint8ClampedArray(CARD_W * CARD_H);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];
  }
  return dHash(gray, CARD_W, CARD_H);
}

async function main() {
  await runMigrations();
  const force = process.argv.includes("--force");
  const editions = await (force
    ? db.select({ id: cardEditions.id, imageUrl: cardEditions.imageUrl }).from(cardEditions)
    : db
        .select({ id: cardEditions.id, imageUrl: cardEditions.imageUrl })
        .from(cardEditions)
        .leftJoin(cardHashes, eq(cardHashes.editionId, cardEditions.id))
        .where(isNull(cardHashes.editionId)));

  console.log(`Hashing ${editions.length} editions${force ? " (forced)" : ""}...`);
  let done = 0;
  let failed = 0;
  const queue = [...editions];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let e = queue.shift(); e; e = queue.shift()) {
        try {
          const phash = await hashImage(e.imageUrl);
          await db
            .insert(cardHashes)
            .values({ editionId: e.id, phash })
            .onConflictDoUpdate({ target: cardHashes.editionId, set: { phash } });
        } catch (err: any) {
          failed++;
          console.warn(`[skip] ${e.id}: ${err.message}`);
        }
        if (++done % 100 === 0) console.log(`  ${done}/${editions.length}`);
      }
    })
  );
  console.log(`Done. Hashed ${done - failed}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
