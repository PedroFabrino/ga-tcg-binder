import { runMigrations } from "../src/db/init";
import { db } from "../src/db";
import { runFullSyncPipeline } from "../src/services/sync-pipeline";

async function main() {
  console.log("==================================================");
  console.log("   GRAND ARCHIVE TCG - UNIFIED SYNC PIPELINE     ");
  console.log("==================================================");

  console.log("\n[1/2] Initializing Database Schema & Migrations...");
  await runMigrations();
  console.log("Database schema initialized successfully.");

  console.log("\n[2/2] Running Sequential Pipeline Stages...");
  const report = await runFullSyncPipeline(db);

  console.log("\n==================================================");
  console.log("               PIPELINE EXECUTION REPORT          ");
  console.log("==================================================");
  console.log(`Overall Status:   ${report.success ? "✅ SUCCESS" : "⚠️ COMPLETED WITH WARNINGS/FAILURES"}`);
  console.log(`Total Duration:   ${(report.totalDurationMs / 1000).toFixed(2)}s\n`);

  for (const stage of report.stages) {
    const icon = stage.status === "success" ? "✅" : stage.status === "skipped" ? "⏭️" : "❌";
    console.log(`${icon} ${stage.stage} (${(stage.durationMs / 1000).toFixed(2)}s)`);
    if (stage.error) {
      console.log(`   └─ Error: ${stage.error}`);
    } else if (stage.details) {
      console.log(`   └─ Details: ${JSON.stringify(stage.details)}`);
    }
  }

  console.log("==================================================\n");

  if (!report.success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during pipeline execution:", err);
  process.exit(1);
});
