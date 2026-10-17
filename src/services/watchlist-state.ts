import { eq, sql } from "drizzle-orm";
import { mypWatchlist, type WatchlistStatus } from "../db/schema";
import { type ParsedMypItem } from "./marketplace";

export interface ReconcilePrintingParams {
  database: any;
  userId: string;
  slug: string;
  cardName: string;
  printing: {
    setPrefix: string;
    collectorNumber: string;
  };
  missing: number;
  targetPriceBrl: number;
  mypItemId: string | null;
  mypProductUrl: string | null;
  existingRow?: any;
  liveMatch?: ParsedMypItem;
}

export async function reconcileShortagePrinting({
  database,
  userId,
  slug,
  cardName,
  printing,
  missing,
  targetPriceBrl,
  mypItemId,
  mypProductUrl,
  existingRow,
  liveMatch,
}: ReconcilePrintingParams): Promise<void> {
  if (liveMatch) {
    if (existingRow) {
      if (liveMatch.quantity !== missing) {
        await database
          .update(mypWatchlist)
          .set({
            status: "pending_update",
            targetQuantity: missing,
            targetPriceBrl,
            mypItemId: mypItemId || existingRow.mypItemId,
            mypProductUrl: mypProductUrl || existingRow.mypProductUrl,
            updatedAt: sql`(strftime('%s', 'now'))`,
          })
          .where(eq(mypWatchlist.id, existingRow.id));
      } else {
        await database
          .update(mypWatchlist)
          .set({
            status: "watching",
            targetQuantity: missing,
            targetPriceBrl,
            mypItemId: mypItemId || existingRow.mypItemId,
            mypProductUrl: mypProductUrl || existingRow.mypProductUrl,
            updatedAt: sql`(strftime('%s', 'now'))`,
          })
          .where(eq(mypWatchlist.id, existingRow.id));
      }
    } else {
      const initialStatus: WatchlistStatus =
        liveMatch.quantity !== missing ? "pending_update" : "watching";
      await database.insert(mypWatchlist).values({
        id: `wl_${crypto.randomUUID()}`,
        userId,
        cardSlug: slug,
        cardName,
        editionSlug: printing.setPrefix,
        collectorNumber: printing.collectorNumber,
        mypItemId,
        mypProductUrl,
        targetQuantity: missing,
        targetPriceBrl,
        status: initialStatus,
      });
    }
  } else {
    if (existingRow) {
      if (existingRow.status === "watching") {
        await database
          .update(mypWatchlist)
          .set({
            status: "ignored",
            updatedAt: sql`(strftime('%s', 'now'))`,
          })
          .where(eq(mypWatchlist.id, existingRow.id));
      } else if (existingRow.status !== "ignored") {
        await database
          .update(mypWatchlist)
          .set({
            status: "pending_add",
            targetQuantity: missing,
            targetPriceBrl,
            mypItemId: mypItemId || existingRow.mypItemId,
            mypProductUrl: mypProductUrl || existingRow.mypProductUrl,
            updatedAt: sql`(strftime('%s', 'now'))`,
          })
          .where(eq(mypWatchlist.id, existingRow.id));
      }
    } else {
      await database.insert(mypWatchlist).values({
        id: `wl_${crypto.randomUUID()}`,
        userId,
        cardSlug: slug,
        cardName,
        editionSlug: printing.setPrefix,
        collectorNumber: printing.collectorNumber,
        mypItemId,
        mypProductUrl,
        targetQuantity: missing,
        targetPriceBrl,
        status: "pending_add",
      });
    }
  }
}

export async function reconcileFilledShortage(
  database: any,
  existingRowsForCard: any[]
): Promise<void> {
  for (const r of existingRowsForCard) {
    if (r.status === "watching" || r.status === "pending_update") {
      await database
        .update(mypWatchlist)
        .set({
          status: "pending_remove",
          updatedAt: sql`(strftime('%s', 'now'))`,
        })
        .where(eq(mypWatchlist.id, r.id));
    } else if (r.status === "pending_add" || r.status === "ignored") {
      await database
        .delete(mypWatchlist)
        .where(eq(mypWatchlist.id, r.id));
    }
  }
}
