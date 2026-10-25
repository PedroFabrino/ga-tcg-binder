import { randomUUID } from "crypto";
import { db } from "../index";
import { rootBotDiagnostics } from "../schema";

export type RootBotDiagnosticDatabase = typeof db;

export async function recordRootBotDiagnostic(
  record: {
    communityId: string;
    stage: string;
    message?: string | null;
  },
  database: RootBotDiagnosticDatabase = db
): Promise<void> {
  await database.insert(rootBotDiagnostics).values({
    id: randomUUID(),
    communityId: record.communityId,
    stage: record.stage,
    message: record.message ?? null,
  });
}
