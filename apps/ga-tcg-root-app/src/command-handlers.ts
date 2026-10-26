import {
  rootServer,
  CommunityAppLogType,
  MessageType,
  WellKnownRootGuids,
  type ChannelMessageCreatedEvent,
  type UserGuid,
} from "@rootsdk/server-app";
import {
  ensureRootRecipientChannel,
  provisionRootDealAlerts,
  removeRootDealAlertChannel,
} from "./deal-alert-notifier";
import { createCommunityConfig } from "./community-config";
import { provisionCommunityChannels } from "./setup-provisioning";
import { RootBotApi, RootBotApiError } from "./root-bot-api";
import { reportDiagnostic } from "./diagnostics";
import { handleLinkCommand, handleRegisterCommand } from "./commands/command-auth";
import { handleDecksCommand } from "./commands/command-decks";
import { handleShortagesCommand } from "./commands/command-shortages";
import { handleCollectionCommand } from "./commands/command-collection";
import { handleWantlistCommand } from "./commands/command-wantlist";
import { handleNotifyCommand, handleSetupCommand } from "./commands/command-notify";
import { handleHelpCommand } from "./commands/command-help";

interface AssistantApiErrorShape {
  status?: number;
  statusCode?: number;
  code: string;
  message: string;
}

function isAssistantApiError(err: unknown): err is AssistantApiErrorShape {
  if (typeof err !== "object" || err === null) return false;
  const record = err as Record<string, unknown>;
  return (
    typeof record.code === "string" &&
    (typeof record.status === "number" || typeof record.statusCode === "number")
  );
}

export interface RootCommandDeps {
  findCollectorId?: (userId: string) => Promise<string | null>;
  setNotificationPreference?: (
    providerUserId: string,
    enabled: boolean,
    mode?: "all" | "hard"
  ) => Promise<void>;
  provisionDealAlerts?: () => Promise<void>;
  removeDealAlertChannel?: (recipientId: string) => Promise<void>;
  ensureRecipientChannel?: (recipientId: string) => Promise<string | null>;
  configureFromChannel?: (channelId: string) => Promise<string | undefined>;
  isCommunityAdmin?: (userId: string) => Promise<boolean>;
}

function defaultRootCommandDeps(
  communityId?: string,
  client?: RootBotApi
): Required<RootCommandDeps> {
  const api = client ?? getRootBotApi(communityId);
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
    async setNotificationPreference(providerUserId, enabled, mode) {
      await api.setNotifyPreference({
        providerUserId,
        enabled,
        ...(mode !== undefined ? { mode } : {}),
      });
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
    async configureFromChannel(_channelId) {
      const config = createCommunityConfig(rootServer.dataStore.appData);
      const res = await provisionCommunityChannels({ rootServer, config });
      return res.marketChannel;
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

export async function processRootCommand(
  userId: string,
  messageContent: string,
  client: RootBotApi = getRootBotApi(),
  deps: RootCommandDeps = {},
  channelId?: string,
  communityId?: string
): Promise<string | null> {
  const resolvedDeps = {
    ...defaultRootCommandDeps(communityId, client),
    ...deps,
  };
  const trimmed = messageContent.trim();
  if (!trimmed.startsWith("/")) return null;

  const [command, ...args] = trimmed.slice(1).split(/\s+/);
  const argString = args.join(" ").trim();
  const cmd = command.toLowerCase();

  try {
    if (cmd === "help") return handleHelpCommand();
    if (cmd === "link") return await handleLinkCommand(argString, userId, client);
    if (cmd === "register") return await handleRegisterCommand(userId, client);
    if (cmd === "decks") return await handleDecksCommand(argString, userId, client);
    if (cmd === "shortages") return await handleShortagesCommand(argString, userId, client);
    if (cmd === "collection") return await handleCollectionCommand(argString, userId, client);
    if (cmd === "wantlist") return await handleWantlistCommand(argString, userId, client);
    if (cmd === "notify") return await handleNotifyCommand(argString, userId, resolvedDeps);
    if (cmd === "setup") return await handleSetupCommand(argString, userId, channelId, resolvedDeps);

    return null;
  } catch (err: unknown) {
    await reportDiagnostic({
      stage: "command-error",
      message: err,
      level: CommunityAppLogType.Error,
    });

    if (isAssistantApiError(err)) {
      if (err.code === "IDENTITY_NOT_LINKED") {
        return (
          "⚠️ **Grand Archive Binder Account Not Linked**\n" +
          "Get started in seconds:\n" +
          "• Run `/register` to create a new binder account instantly\n" +
          "• Or run `/link <code>` using a pairing code from GA Binder web app."
        );
      }
      if (err.code === "DECK_NOT_FOUND") {
        return `⚠️ **Deck Not Found**\nCould not find a deck matching "${argString}". Run \`/decks\` to see all your active decks.`;
      }
      return `⚠️ **Assistant Error:** ${err.message}`;
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return `⚠️ **Error executing command:** ${message}`;
  }
}

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
