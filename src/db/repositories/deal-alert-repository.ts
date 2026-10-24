import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  dealAlertMessages,
  type DealAlertMessageRow,
  type InsertDealAlertMessageRow,
} from "../schema";

export type DealAlertDatabase = typeof db;

/**
 * Returns the tracked rolling deal-alert message for a Discord user, if any.
 */
export async function getDealAlertMessage(
  discordUserId: string,
  database: DealAlertDatabase = db
): Promise<DealAlertMessageRow | undefined> {
  const [row] = await database
    .select()
    .from(dealAlertMessages)
    .where(eq(dealAlertMessages.discordUserId, discordUserId))
    .limit(1);

  return row;
}

/**
 * Inserts or replaces the tracked rolling deal-alert message for a Discord user.
 */
export async function upsertDealAlertMessage(
  record: InsertDealAlertMessageRow,
  database: DealAlertDatabase = db
): Promise<void> {
  await database
    .insert(dealAlertMessages)
    .values(record)
    .onConflictDoUpdate({
      target: dealAlertMessages.discordUserId,
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
 * Deletes the tracked rolling deal-alert message for a Discord user.
 */
export async function deleteDealAlertMessage(
  discordUserId: string,
  database: DealAlertDatabase = db
): Promise<void> {
  await database
    .delete(dealAlertMessages)
    .where(eq(dealAlertMessages.discordUserId, discordUserId));
}
