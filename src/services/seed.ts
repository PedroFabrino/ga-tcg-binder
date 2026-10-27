import { db } from "@/db";
import { runMigrations } from "../db/init";
import { seedMetaArchetypes } from "./meta";
import { DEFAULT_USER_ID } from "@/lib/default-user";
import {
  findUserById,
  createUser,
  migrateDefaultUserDataToUser,
  type AuthDatabase,
} from "@/db/repositories/auth-repository";
import { upsertMarketStore } from "@/db/repositories/marketplace-repository";

export { DEFAULT_USER_ID } from "@/lib/default-user";
export { migrateDefaultUserDataToUser };

async function doSeed(database: AuthDatabase = db) {
  const existing = await findUserById(DEFAULT_USER_ID, database);

  if (!existing) {
    await createUser(
      {
        id: DEFAULT_USER_ID,
        name: "Alex",
        email: "alex@grandarchive.local",
        friendCode: "GA-ALEX01",
        lowPopThreshold: 1000,
      },
      database
    );
  }

  // Also seed a demo friend to demonstrate idle borrowing right away
  const demoFriend = await findUserById("user_friend_bob", database);

  if (!demoFriend) {
    await createUser(
      {
        id: "user_friend_bob",
        name: "Bob (Playgroup Friend)",
        email: "bob@grandarchive.local",
        friendCode: "GA-BOB77",
        lowPopThreshold: 1000,
      },
      database
    );
  }

  await seedMetaArchetypes(database);
  await seedMarketStores(database);
}

export async function seedMarketStores(database?: AuthDatabase) {
  const stores = [
    {
      id: "myp",
      platform: "myp",
      name: "MyP Cards",
      baseUrl: "https://mypcards.com",
      tcgId: "grandarchive",
      enabled: true,
    },
    {
      id: "brandao",
      platform: "liga_store",
      name: "Brandão Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      tcgId: "21",
      enabled: true,
    },
    {
      id: "tabletopsorocaba",
      platform: "liga_store",
      name: "TabletopSorocaba",
      baseUrl: "https://www.tabletoptcg.com.br",
      tcgId: "21",
      enabled: true,
    },
    {
      id: "lootcards",
      platform: "lootcards",
      name: "Lootcards",
      baseUrl: "https://lootcards.store",
      tcgId: "grandarchive",
      enabled: true,
    },
  ];

  for (const s of stores) {
    await upsertMarketStore(s, database);
  }
}

let defaultSeedPromise: Promise<void> | null = null;

export async function ensureDefaultUserAndSeed(database?: AuthDatabase) {
  if (database) {
    return doEnsureDefaultUserAndSeed(database);
  }
  if (!defaultSeedPromise) {
    defaultSeedPromise = doEnsureDefaultUserAndSeed(db).catch((err) => {
      defaultSeedPromise = null;
      throw err;
    });
  }
  return defaultSeedPromise;
}

async function doEnsureDefaultUserAndSeed(database: AuthDatabase) {
  try {
    await doSeed(database);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      errorMsg.includes("no such table") ||
      errorMsg.includes("no such column") ||
      errorMsg.includes("sqlite_error")
    ) {
      await runMigrations();
      await doSeed(database);
      return;
    }
    throw error;
  }
}
