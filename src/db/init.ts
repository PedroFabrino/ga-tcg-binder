import fs from "fs";
import path from "path";
import { client } from "./index";

export async function runMigrations(customClient = client) {
  const sqlPath = path.join(process.cwd(), "drizzle", "0000_thankful_tinkerer.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Migration file not found at ${sqlPath}`);
  }
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");
  const statements = sqlContent
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await customClient.execute(statement);
  }
}
