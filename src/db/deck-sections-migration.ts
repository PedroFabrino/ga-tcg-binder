import { client } from "./index";

/**
 * Backfills existing decks with default section ('4fun') if missing or null,
 * and ensures sequential zero-indexed priorities (0, 1, 2, ...) per user and section
 * ordered by created_at ASC, id ASC when collisions or unranked decks are detected.
 */
export async function migrateDeckSectionsAndPriorities(customClient: typeof client): Promise<void> {
  try {
    await customClient.execute(
      "UPDATE `decks` SET `section` = '4fun' WHERE `section` IS NULL OR `section` = '';"
    );
    await customClient.execute(
      "UPDATE `decks` SET `priority` = 0 WHERE `priority` IS NULL;"
    );

    const collidedGroups = await customClient.execute(
      "SELECT `user_id`, `section` FROM `decks` GROUP BY `user_id`, `section` HAVING COUNT(*) > 1 AND COUNT(DISTINCT `priority`) < COUNT(*);"
    );

    for (const group of collidedGroups.rows) {
      const userId = group.user_id as string;
      const section = group.section as string;

      const userDecks = await customClient.execute({
        sql: "SELECT `id` FROM `decks` WHERE `user_id` = ? AND `section` = ? ORDER BY `priority` ASC, `created_at` ASC, `id` ASC;",
        args: [userId, section],
      });

      for (let i = 0; i < userDecks.rows.length; i++) {
        const deckId = userDecks.rows[i].id as string;
        await customClient.execute({
          sql: "UPDATE `decks` SET `priority` = ? WHERE `id` = ?;",
          args: [i, deckId],
        });
      }
    }
  } catch (err) {
    console.warn(
      "[migrations] Could not migrate deck sections and priorities:",
      err instanceof Error ? err.message : err
    );
  }
}
