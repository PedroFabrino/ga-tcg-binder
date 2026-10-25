import { client } from "../src/db";

async function main() {
  const diag = await client.execute(
    "SELECT stage, community_id, substr(message, 1, 400) AS message, created_at FROM root_bot_diagnostics ORDER BY created_at DESC LIMIT 30"
  );
  console.log("diagnostics:", JSON.stringify(diag.rows, null, 2));

  const installs = await client.execute(
    "SELECT app_id, community_id, created_at, revoked_at FROM root_bot_installs ORDER BY created_at DESC"
  );
  console.log("installs:", JSON.stringify(installs.rows));

  const deliveries = await client.execute(
    "SELECT destination, COUNT(*) AS n, MAX(delivered_at) AS last FROM notification_deliveries WHERE destination LIKE 'root:%' GROUP BY destination"
  );
  console.log("root deliveries:", JSON.stringify(deliveries.rows));

  const alerts = await client.execute(
    "SELECT destination, COUNT(*) AS n FROM deal_alert_messages WHERE destination LIKE 'root:%' GROUP BY destination"
  );
  console.log("root deal-alert state:", JSON.stringify(alerts.rows));
  console.log("now:", new Date().toISOString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
