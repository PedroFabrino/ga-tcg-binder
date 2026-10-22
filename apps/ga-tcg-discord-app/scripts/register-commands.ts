import { ASSISTANT_COMMANDS } from "../src/commands";

async function registerCommands() {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_DEV_GUILD_ID || process.env.DISCORD_GUILD_ID;

  if (!appId || !token) {
    console.error("Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN environment variables.");
    process.exit(1);
  }

  const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const scopeLabel = guildId ? `Guild (${guildId})` : "Global (all servers)";
  console.log(`Registering ${ASSISTANT_COMMANDS.length} slash commands to Discord application ${appId} for ${scopeLabel}...`);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ASSISTANT_COMMANDS),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Failed to register commands (${response.status}):`, errorBody);
    process.exit(1);
  }

  const result = await response.json();
  console.log("Successfully registered commands:", result.map((c: any) => c.name).join(", "));
}

registerCommands().catch((err) => {
  console.error("Error registering Discord commands:", err);
  process.exit(1);
});
