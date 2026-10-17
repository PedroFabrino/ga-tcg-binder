import {
  insertWatchlistEntry,
  updateWatchlistEntry,
  deleteWatchlistItemsByIds,
  type WatchlistRow,
} from "@/db/repositories/watchlist-repository";
import type { WatchlistStatus } from "@/db/schema";
import type { ParsedMypItem } from "./marketplace";
import crypto from "crypto";

export interface PrintingTarget {
  slug: string;
  cardName: string;
  setPrefix: string;
  collectorNumber: string;
  missing: number;
  targetPriceBrl: number;
  mypItemId: string | null;
  mypProductUrl: string | null;
}

export interface ReconcileContext {
  userId: string;
  database?: unknown;
  hasLiveQueroSnapshot: boolean;
  existingRow?: WatchlistRow;
  liveMatch?: ParsedMypItem;
}

export async function reconcileShortagePrinting(
  target: PrintingTarget,
  ctx: ReconcileContext
): Promise<void> {
  const { database, userId, hasLiveQueroSnapshot, existingRow, liveMatch } = ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  const dbParam = database as any;

  if (liveMatch) {
    if (existingRow) {
      const isQtyDifferent = liveMatch.quantity !== target.missing;
      const nextStatus: WatchlistStatus = isQtyDifferent ? "pending_update" : "watching";
      await updateWatchlistEntry(
        existingRow.id,
        {
          status: nextStatus,
          targetQuantity: target.missing,
          targetPriceBrl: target.targetPriceBrl,
          mypItemId: target.mypItemId || existingRow.mypItemId,
          mypProductUrl: target.mypProductUrl || existingRow.mypProductUrl,
          syncedQuantity: liveMatch.quantity,
        },
        dbParam
      );
    } else {
      const initialStatus: WatchlistStatus =
        liveMatch.quantity !== target.missing ? "pending_update" : "watching";
      await insertWatchlistEntry(
        {
          id: `wl_${crypto.randomUUID()}`,
          userId,
          cardSlug: target.slug,
          cardName: target.cardName,
          editionSlug: target.setPrefix,
          collectorNumber: target.collectorNumber,
          mypItemId: target.mypItemId,
          mypProductUrl: target.mypProductUrl,
          targetQuantity: target.missing,
          syncedQuantity: liveMatch.quantity,
          targetPriceBrl: target.targetPriceBrl,
          status: initialStatus,
        },
        dbParam
      );
    }
  } else {
    if (existingRow) {
      // Only transition 'watching' -> 'ignored' if we have an authoritative live Quero snapshot
      if (existingRow.status === "watching") {
        if (hasLiveQueroSnapshot) {
          await updateWatchlistEntry(
            existingRow.id,
            { status: "ignored" },
            dbParam
          );
        }
      } else if (existingRow.status !== "ignored") {
        await updateWatchlistEntry(
          existingRow.id,
          {
            status: "pending_add",
            targetQuantity: target.missing,
            targetPriceBrl: target.targetPriceBrl,
            mypItemId: target.mypItemId || existingRow.mypItemId,
            mypProductUrl: target.mypProductUrl || existingRow.mypProductUrl,
          },
          dbParam
        );
      }
    } else {
      await insertWatchlistEntry(
        {
          id: `wl_${crypto.randomUUID()}`,
          userId,
          cardSlug: target.slug,
          cardName: target.cardName,
          editionSlug: target.setPrefix,
          collectorNumber: target.collectorNumber,
          mypItemId: target.mypItemId,
          mypProductUrl: target.mypProductUrl,
          targetQuantity: target.missing,
          targetPriceBrl: target.targetPriceBrl,
          status: "pending_add",
        },
        dbParam
      );
    }
  }
}

export async function reconcileFilledShortage(
  existingRowsForCard: WatchlistRow[],
  database?: unknown
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  const dbParam = database as any;
  for (const r of existingRowsForCard) {
    if (r.status === "watching" || r.status === "pending_update") {
      await updateWatchlistEntry(
        r.id,
        { status: "pending_remove" },
        dbParam
      );
    } else if (r.status === "pending_add" || r.status === "ignored") {
      // If was never on MyP, or already ignored, delete from ledger directly
      await deleteWatchlistItemsByIds(r.userId, [r.id], dbParam);
    }
  }
}
