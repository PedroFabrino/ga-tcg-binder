import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

export async function createTestDb() {
  const memClient = createClient({
    url: ":memory:",
  });
  const memDb = drizzle(memClient, { schema });

  const sqlPath = path.join(process.cwd(), "drizzle", "0000_thankful_tinkerer.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");
  const statements = sqlContent
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await memClient.execute(statement);
  }

  return { client: memClient, db: memDb };
}
