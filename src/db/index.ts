import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const databaseUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url: databaseUrl,
  authToken: authToken,
});

export const db = drizzle(client, { schema });

// Helper to create an in-memory database instance for isolated tests
export function createInMemoryDb() {
  const memClient = createClient({
    url: ":memory:",
  });
  const memDb = drizzle(memClient, { schema });
  return { client: memClient, db: memDb };
}
