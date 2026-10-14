import { db } from "../db";
import { users } from "../db/schema";
import { runMigrations } from "../db/init";
import { seedMetaArchetypes } from "./meta";
import { eq } from "drizzle-orm";

export const DEFAULT_USER_ID = "user_default";

async function doSeed(database = db) {
  const existing = await database
    .select()
    .from(users)
    .where(eq(users.id, DEFAULT_USER_ID))
    .get();

  if (!existing) {
    await database.insert(users).values({
      id: DEFAULT_USER_ID,
      name: "Alex",
      email: "alex@grandarchive.local",
      friendCode: "GA-ALEX01",
      lowPopThreshold: 1000,
    });
  }

  // Also seed a demo friend to demonstrate idle borrowing right away
  const demoFriend = await database
    .select()
    .from(users)
    .where(eq(users.id, "user_friend_bob"))
    .get();

  if (!demoFriend) {
    await database.insert(users).values({
      id: "user_friend_bob",
      name: "Bob (Playgroup Friend)",
      email: "bob@grandarchive.local",
      friendCode: "GA-BOB77",
      lowPopThreshold: 1000,
    });
  }

  await seedMetaArchetypes(database);
}

export async function ensureDefaultUserAndSeed(database = db) {
  try {
    await doSeed(database);
  } catch (err: any) {
    const errorMsg = (err?.message || "").toLowerCase();
    if (errorMsg.includes("no such table") || errorMsg.includes("sqlite_error")) {
      await runMigrations();
      await doSeed(database);
      return;
    }
    throw err;
  }
}
