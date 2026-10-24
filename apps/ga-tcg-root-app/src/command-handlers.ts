import { AssistantApiError } from "@ga/contracts";
import {
  rootServer,
  MessageType,
  WellKnownRootGuids,
  type ChannelGuid,
  type ChannelMessageCreatedEvent,
  type UserGuid,
} from "@rootsdk/server-bot";
import {
  ensureRootRecipientChannel,
  provisionRootDealAlerts,
  removeRootDealAlertChannel,
} from "./deal-alert-notifier";
import { createCommunityConfig } from "./community-config";
import { RootBotApi, RootBotApiError } from "./root-bot-api";

/**
 * Injectable side effects for the Root commands. Defaults use the shared
 * database; tests pass fakes so the command logic stays pure.
 */
export interface RootCommandDeps {
  findCollectorId?: (userId: string) => Promise<string | null>;
  setNotificationPreference?: (
    providerUserId: string,
    enabled: boolean
  ) => Promise<void>;
  provisionDealAlerts?: () => Promise<void>;
  removeDealAlertChannel?: (recipientId: string) => Promise<void>;
  ensureRecipientChannel?: (recipientId: string) => Promise<string | null>;
  configureFromChannel?: (channelId: string) => Promise<void>;
  isCommunityAdmin?: (userId: string) => Promise<boolean>;
}

function defaultRootCommandDeps(
  communityId?: string
): Required<RootCommandDeps> {
  const api = getRootBotApi(communityId);
  const recipientOptions = { communityId, api };

  return {
    async findCollectorId(userId) {
      try {
        const resolved = await api.getCollector(userId);
        return resolved?.collectorId ?? null;
      } catch (err) {
        if (err instanceof RootBotApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    async setNotificationPreference(providerUserId, enabled) {
      await api.setNotifyPreference({ providerUserId, enabled });
    },
    async provisionDealAlerts() {
      await provisionRootDealAlerts(recipientOptions);
    },
    async removeDealAlertChannel(recipientId) {
      await removeRootDealAlertChannel(recipientId, recipientOptions);
    },
    async ensureRecipientChannel(recipientId) {
      return ensureRootRecipientChannel(recipientId, recipientOptions);
    },
    async configureFromChannel(channelId) {
      const config = createCommunityConfig(rootServer.dataStore.appData);
      await config.setBroadcastChannelId(channelId);

      try {
        const channel = await rootServer.community.channels.get({
          id: channelId as unknown as ChannelGuid,
        });
        await config.setAlertSectionId(String(channel.channelGroupId));
      } catch (err) {
        console.warn(
          "[setup] Could not resolve the channel's group; the bot will fall back to creating its own deal-alert section.",
          err instanceof Error ? err.message : err
        );
      }
    },
    async isCommunityAdmin(userId) {
      const community = await rootServer.community.communities.get();
      if (String(community.ownerUserId) === userId) {
        return true;
      }

      const [member, roles] = await Promise.all([
        rootServer.community.communityMembers.get({
          userId: userId as unknown as UserGuid,
        }),
        rootServer.community.communityRoles.list(),
      ]);

      const roleIds = new Set(member.communityRoleIds.map((id) => String(id)));
      roleIds.add(String(WellKnownRootGuids.CommunityRoles.EveryoneRole));

      return roles.some(
        (role) =>
          roleIds.has(String(role.id)) &&
          (role.communityPermission.communityManageApps ||
            role.communityPermission.communityFullControl)
      );
    },
  };
}

export function getRootBotApi(communityId?: string): RootBotApi {
  return new RootBotApi({
    communityId: communityId ?? process.env.COMMUNITY_ID ?? "",
  });
}

/**
 * Parses and executes a Root slash command from incoming channel messages.
 * Returns the markdown reply string, or null if message is not a recognized command.
 */
export async function processRootCommand(
  userId: string,
  messageContent: string,
  client: RootBotApi = getRootBotApi(),
  deps: RootCommandDeps = {},
  channelId?: string,
  communityId?: string
): Promise<string | null> {
  const resolvedDeps = { ...defaultRootCommandDeps(communityId), ...deps };
  const trimmed = messageContent.trim();
  if (!trimmed.startsWith("/")) return null;

  const [command, ...args] = trimmed.slice(1).split(/\s+/);
  const argString = args.join(" ").trim();

  try {
    // 1. /link <code>
    if (command === "link") {
      if (!argString) {
        return "⚠️ **Usage:** `/link <code>`\nProvide the 6-character pairing code from **Settings > Linked Accounts** in GA Binder.";
      }

      const res = await client.link({
        token: argString.toUpperCase(),
        provider: "root",
        providerUserId: userId,
      });

      return `✅ **Account Linked Successfully!**\nYour Root account is now paired to **${res.collectorName || "Collector"}**.\n\nYou can now use \`/decks\`, \`/shortages\`, \`/collection\`, and \`/wantlist\`!`;
    }

    // 2. /decks
    if (command === "decks") {
      const res = await client.getDecks(userId);
      if (res.decks.length === 0) {
        return `🗃️ **${res.collectorName || "Collector"}'s Decks**\nYou don't have any saved decks yet. Create one in the GA Binder web app!`;
      }

      const lines = [`### 🗃️ **${res.collectorName || "Collector"}'s Decks (${res.decks.length})**`];
      for (const deck of res.decks) {
        const icon = deck.completionPercentage === 100 ? "✅" : "⚠️";
        lines.push(`- **${deck.name}** (${deck.format})`);
        lines.push(`  - Champion: **${deck.champion || "None"}** | Cards: ${deck.totalCards} (${deck.uniqueCards} unique)`);
        lines.push(`  - Completion: **${deck.completionPercentage}%** ${icon}`);
        if (deck.hardShortageCount > 0) {
          lines.push(`  - 🔴 Hard Shortages: **${deck.hardShortageCount}**`);
        }
        if (deck.sharedShortageCount > 0) {
          lines.push(`  - 🟡 Shared Shortages: **${deck.sharedShortageCount}**`);
        }
      }
      lines.push("\n*Use `/shortages <deck>` to see itemized shortages.*");
      return lines.join("\n");
    }

    // 3. /shortages <deck>
    if (command === "shortages") {
      if (!argString) {
        return "⚠️ **Usage:** `/shortages <deck_name>`\nPlease specify which deck to check.";
      }

      const shortages = await client.getShortages(userId, argString);
      const isComplete =
        shortages.hardShortages.length === 0 && shortages.sharedShortages.length === 0;

      if (isComplete) {
        return `🎉 **${shortages.deckName} — 100% Complete!**\nAll required cards are owned with zero shortages. Ready to sleeve!`;
      }

      const lines = [
        `### 📊 **Shortages for ${shortages.deckName}** (${shortages.completionPercentage}%)`,
        `Format: **${shortages.format}** | Total Shortages: **${shortages.totalHardShortages + shortages.totalSharedShortages}**\n`,
      ];

      if (shortages.hardShortages.length > 0) {
        lines.push(`**🔴 Hard Shortages (Compra Necessária — ${shortages.totalHardShortages}):**`);
        for (const h of shortages.hardShortages) {
          lines.push(`- **${h.cardName}** x${h.missingQuantity} missing (needs ${h.requiredQuantity})`);
        }
        lines.push("");
      }

      if (shortages.sharedShortages.length > 0) {
        lines.push(`**🟡 Shared Shortages (Revezamento entre Decks — ${shortages.totalSharedShortages}):**`);
        for (const s of shortages.sharedShortages) {
          const contending = s.competingDecks.length > 0 ? ` *(used in ${s.competingDecks.join(", ")})*` : "";
          lines.push(`- **${s.cardName}** x${s.sharedQuantity} shared${contending}`);
        }
      }

      return lines.join("\n");
    }

    // 4. /collection <query>
    if (command === "collection") {
      if (!argString) {
        return "⚠️ **Usage:** `/collection <card_name>`\nPlease specify a card name to search.";
      }

      const res = await client.searchCollection(userId, argString);
      if (res.cards.length === 0) {
        return `🔍 **Collection Search: "${argString}"**\nNo matching cards found in your personal Binder.`;
      }

      const lines = [`### 🔍 **Collection Search: "${argString}"** (${res.cards.length} match${res.cards.length > 1 ? "es" : ""})`];
      for (const card of res.cards.slice(0, 5)) {
        lines.push(`- **${card.cardName}** (${card.element} ${card.type}) — Total: **${card.totalOwned}**`);
        lines.push(`  - Dedicated: ${card.dedicatedTotal} | Idle: ${card.idleTotal}`);
        for (const p of card.printings) {
          lines.push(`  - • ${p.setPrefix}-${p.collectorNumber} ${p.foil ? "★ Foil" : "Normal"} x${p.quantity} (${p.isDedicated ? "Dedicated" : "Idle"})`);
        }
      }
      return lines.join("\n");
    }

    // 5. /wantlist [deck]
    if (command === "wantlist") {
      const wantlist = await client.getWantlist(userId, argString || undefined);
      if (wantlist.decks.length === 0) {
        return "📋 **Wantlist**\nZero shortages detected across your active decks! Your collection fully covers them.";
      }

      const lines = [
        `### 📋 **Wantlist (${wantlist.totalDecks} Deck${wantlist.totalDecks > 1 ? "s" : ""})**`,
        `Grand Total: **${wantlist.grandTotalHard}** Hard (🔴) | **${wantlist.grandTotalShared}** Shared (🟡)\n`,
      ];

      for (const group of wantlist.decks) {
        lines.push(`**${group.deckName}** (${group.totalShortages} shortages):`);
        for (const h of group.hardShortages) {
          lines.push(`- 🔴 **${h.cardName}** x${h.missingQuantity}`);
        }
        for (const s of group.sharedShortages) {
          lines.push(`- 🟡 **${s.cardName}** x${s.sharedQuantity}`);
        }
        lines.push("");
      }

      return lines.join("\n");
    }

    // 6. /notify [on|off]
    if (command === "notify") {
      const action = argString.toLowerCase();

      if (action !== "on" && action !== "off") {
        return "⚠️ **Usage:** `/notify on|off`\nTurn private deal alerts on or off.";
      }

      const collectorId = await resolvedDeps.findCollectorId(userId);

      if (!collectorId) {
        return "⚠️ **Grand Archive Binder Account Not Linked**\nLink your account first:\n1. Open GA Binder > **Settings > Linked Accounts**\n2. Click **Generate Code**\n3. Run `/link <code>` here in Root.";
      }

      if (action === "on") {
        await resolvedDeps.setNotificationPreference(userId, true);

        let alertsChannelId: string | null = null;
        try {
          alertsChannelId = await resolvedDeps.ensureRecipientChannel(userId);
        } catch (err) {
          console.warn(
            "[notify] Could not create the private deal-alert channel yet:",
            err instanceof Error ? err.message : err
          );
        }

        await resolvedDeps.provisionDealAlerts();

        return alertsChannelId
          ? `🔔 **Deal alerts enabled.** Your alerts will arrive in [your private channel](root://channel/${alertsChannelId}).`
          : "🔔 **Deal alerts enabled.** Your private channel will be created on the next marketplace sync.";
      }

      await resolvedDeps.setNotificationPreference(userId, false);
      await resolvedDeps.removeDealAlertChannel(userId);
      return "🔕 **Deal alerts disabled.**\nYour private deal-alert channel has been removed.";
    }

    // 7. /setup
    if (command === "setup") {
      if (!(await resolvedDeps.isCommunityAdmin(userId))) {
        return "⚠️ Only community admins (Manage Apps) or the owner can run `/setup`.";
      }

      if (!channelId) {
        return "⚠️ Run `/setup` inside the channel you want market updates posted to.";
      }

      if (argString.toLowerCase() !== "confirm") {
        return "⚠️ **This channel will become the market dump.** Every store update will be posted here.\nRun `/setup confirm` in this channel to apply it.";
      }

      await resolvedDeps.configureFromChannel(channelId);
      return "✅ **Setup complete.** This channel is now the market dump — store updates will be posted here, and per-user alert channels will be created in this channel's group.";
    }

    return null;
  } catch (err: any) {
    if (err instanceof AssistantApiError) {
      if (err.code === "IDENTITY_NOT_LINKED") {
        return "⚠️ **Grand Archive Binder Account Not Linked**\nLink your account first:\n1. Open GA Binder > **Settings > Linked Accounts**\n2. Click **Generate Code**\n3. Run `/link <code>` here in Root.";
      }
      if (err.code === "DECK_NOT_FOUND") {
        return `⚠️ **Deck Not Found**\nCould not find a deck matching "${argString}". Run \`/decks\` to see all your active decks.`;
      }
      return `⚠️ **Assistant Error:** ${err.message}`;
    }

    return `⚠️ **Error executing command:** ${err?.message || "Unknown error"}`;
  }
}

/**
 * Subscribes to Root channel messages and executes assistant commands.
 */
export function registerRootCommandHandlers(communityId?: string): void {
  rootServer.community.channelMessages.on(
    "channelMessage.created" as any,
    async (evt: ChannelMessageCreatedEvent) => {
      if (evt.messageType === MessageType.System) return;
      if (!evt.messageContent || !evt.messageContent.startsWith("/")) return;

      const reply = await processRootCommand(
        evt.userId,
        evt.messageContent,
        getRootBotApi(communityId),
        undefined,
        String(evt.channelId),
        communityId
      );
      if (!reply) return;

      try {
        await rootServer.community.channelMessages.create({
          channelId: evt.channelId,
          content: reply,
        });
      } catch (err) {
        console.error("Failed to send Root message reply:", err);
      }
    }
  );
}
