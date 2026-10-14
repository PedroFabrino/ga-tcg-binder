import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { runMigrations } from "./init";

export async function createTestDb() {
  const memClient = createClient({
    url: ":memory:",
  });
  const memDb = drizzle(memClient, { schema });

  await runMigrations(memClient);

  return { client: memClient, db: memDb };
}
