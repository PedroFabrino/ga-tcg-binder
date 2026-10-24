import { and, eq } from "drizzle-orm";
import { db } from "../index";
import {
  dealAlertMessages,
  type DealAlertMessageRow,
  type InsertDealAlertMessageRow,
} from "../schema";

export type DealAlertDatabase = typeof db;

/**
 * Returns the tracked rolling deal-alert message for a recipient on a
 * destination (e.g. `discord-dm`, `root-alert`), if any.
 */
export async function getDealAlertMessage(
  destination: string,
  recipientId: string,
  database: DealAlertDatabase = db
): Promise<DealAlertMessageRow | undefined> {
  const [row] = await database
    .select()
    .from(dealAlertMessages)
    .where(
      and(
        eq(dealAlertMessages.destination, destination),
        eq(dealAlertMessages.recipientId, recipientId)
      )
    )
    .limit(1);

  return row;
}

/**
 * Inserts or replaces the tracked rolling deal-alert message for a recipient
 * on a destination.
 */
export async function upsertDealAlertMessage(
  record: InsertDealAlertMessageRow,
  database: DealAlertDatabase = db
): Promise<void> {
  await database
    .insert(dealAlertMessages)
    .values(record)
    .onConflictDoUpdate({
      target: [dealAlertMessages.destination, dealAlertMessages.recipientId],
      set: {
        channelId: record.channelId,
        messageId: record.messageId,
        lastListingKeys: record.lastListingKeys,
        updatedAt: record.updatedAt,
      },
    });
}

/**
 * Returns all tracked rolling deal-alert messages.
 */
export async function listAllDealAlertMessages(
  database: DealAlertDatabase = db
): Promise<DealAlertMessageRow[]> {
  return database.select().from(dealAlertMessages);
}

/**
 * Deletes the tracked rolling deal-alert message for a recipient on a
 * destination.
 */
export async function deleteDealAlertMessage(
  destination: string,
  recipientId: string,
  database: DealAlertDatabase = db
): Promise<void> {
  await database
    .delete(dealAlertMessages)
    .where(
      and(
        eq(dealAlertMessages.destination, destination),
        eq(dealAlertMessages.recipientId, recipientId)
      )
    );
}
