import {
  rootServer,
  ChannelType,
  WellKnownRootGuids,
  type ChannelGuid,
  type ChannelGroupGuid,
  type ChannelOrChannelGroupGuid,
  type MessageGuid,
  type RoleOrMemberGuid,
  type UserGuid,
} from "@rootsdk/server-app";
import {
  parseMessageIds,
  type DealAlertNotificationSummary,
  type DirectMessageRef,
  type DirectMessageSink,
} from "./deal-alert-sink";
import { describeError } from "./describe-error";

/**
 * The narrow slice of the Root server SDK the deal-alert transport needs.
 * Kept as an interface so tests can inject a fake without loading the SDK.
 */
export interface RootDealAlertAccessRule {
  roleOrMemberId: string;
  overlay?: {
    channelView?: boolean;
    channelCreateMessage?: boolean;
    channelViewMessageHistory?: boolean;
    channelFullControl?: boolean;
  };
}

export interface RootDealAlertApi {
  everyoneRoleId: string;
  /** The bot's own id; used to grant the bot access to the channels it creates. */
  botId: string;
  createChannel(request: {
    channelGroupId: string;
    name: string;
    channelType: number;
    useChannelGroupPermission: boolean;
    accessRuleCreates: RootDealAlertAccessRule[];
  }): Promise<{ id: string }>;
  createChannelGroup(name: string): Promise<{ id: string }>;
  /** Best-effort grant of `channelFullControl` to the bot on a channel group. */
  grantBotFullControl(channelGroupId: string): Promise<void>;
  /** Resolves a member's display name, or throws if the member is unknown. */
  getMemberName(userId: string): Promise<string>;
  createMessage(request: {
    channelId: string;
    content: string;
  }): Promise<{ id: string }>;
  /** Resolves the channel if it still exists, or throws when it does not. */
  getChannel(id: string): Promise<{ id: string }>;
  /** Lists channels in a group so orphaned/duplicate wantlist channels can be cleaned up. */
  listChannels?(
    channelGroupId: string
  ): Promise<Array<{ id: string; name: string }>>;
  deleteMessage(request: { channelId: string; id: string }): Promise<void>;
  deleteChannel(id: string): Promise<void>;
  sendNotification(request: {
    userIds: string[];
    title: string;
    description?: string;
  }): Promise<void>;
}

/** Default adapter over `rootServer.community`. */
export function createRootServerDealAlertApi(
  root: typeof rootServer = rootServer
): RootDealAlertApi {
  const botId = String(root.appId);

  return {
    everyoneRoleId: String(WellKnownRootGuids.CommunityRoles.EveryoneRole),
    botId,
    async createChannel(request) {
      const channel = await root.community.channels.create({
        channelGroupId: request.channelGroupId as ChannelGroupGuid,
        name: request.name,
        channelType: request.channelType,
        useChannelGroupPermission: request.useChannelGroupPermission,
        ...(request.accessRuleCreates.length > 0
          ? {
              accessRuleCreates: request.accessRuleCreates.map((rule) => ({
                roleOrMemberId: rule.roleOrMemberId as RoleOrMemberGuid,
                overlay: rule.overlay,
              })),
            }
          : {}),
      });
      return { id: String(channel.id) };
    },
    async createChannelGroup(name) {
      const group = await root.community.channelGroups.create({
        name,
      });
      return { id: String(group.id) };
    },
    async grantBotFullControl(channelGroupId) {
      await root.community.accessRules.create({
        channelOrChannelGroupId: channelGroupId as ChannelOrChannelGroupGuid,
        roleOrMemberId: botId as RoleOrMemberGuid,
        overlay: { channelFullControl: true },
      });
    },
    async getMemberName(userId) {
      const member = await root.community.communityMembers.get({
        userId: userId as UserGuid,
      });
      return member.nickname;
    },
    async createMessage(request) {
      const message = await root.community.channelMessages.create({
        channelId: request.channelId as ChannelGuid,
        content: request.content,
      });
      return { id: String(message.id) };
    },
    async getChannel(id) {
      const channel = await root.community.channels.get({
        id: id as ChannelGuid,
      });
      return { id: String(channel.id) };
    },
    async listChannels(channelGroupId) {
      const channels = await root.community.channels.list({
        channelGroupId: channelGroupId as ChannelGroupGuid,
      });
      return channels.map((channel) => ({
        id: String(channel.id),
        name: channel.name,
      }));
    },
    async deleteMessage(request) {
      await root.community.channelMessages.delete({
        channelId: request.channelId as ChannelGuid,
        id: request.id as MessageGuid,
      });
    },
    async deleteChannel(id) {
      await root.community.channels.delete({ id: id as ChannelGuid });
    },
    async sendNotification(request) {
      await root.community.notifications.send({
        userIds: request.userIds as UserGuid[],
        title: request.title,
        description: request.description,
      });
    },
  };
}

export interface RootDealAlertTransportOptions {
  /** The bot-only channel section (channel group) that holds per-user channels. */
  channelGroupId: string;
  api: RootDealAlertApi;
  /** `ChannelType.Text` by default. */
  channelType?: number;
}

function fallbackChannelName(recipient: string): string {
  return `ga-alerts-${recipient}`.slice(0, 100);
}

/**
 * Root delivery for Deal Alerts: one private channel per recipient under the
 * bot-only section, a rolling message inside it, and a short in-app
 * notification ping. Access rules deny `channelView` to everyone and grant it
 * to the recipient so other members cannot see the channel.
 */
export function createRootDealAlertTransport({
  channelGroupId,
  api,
  channelType = ChannelType.Text,
}: RootDealAlertTransportOptions): DirectMessageSink {
  const verifiedChannels = new Set<string>();

  return {
    async send(recipient, content, previousChannelId) {
      if (previousChannelId && verifiedChannels.has(previousChannelId)) {
        const message = await api.createMessage({
          channelId: previousChannelId,
          content,
        });
        return { channelId: previousChannelId, messageId: message.id };
      }

      const fallbackName = fallbackChannelName(recipient);
      let channelName = fallbackName;
      try {
        const displayName = await api.getMemberName(recipient);
        if (displayName && displayName.trim()) {
          // Root channel names reject spaces, so use a dash separator.
          channelName = `${displayName.trim()}-Wantlist`.slice(0, 100);
        }
      } catch (err) {
        console.warn(
          `[deal-alert-transport] Could not resolve member name for ${recipient}; using fallback:`,
          describeError(err)
        );
      }

      let channelId: string | undefined;
      if (previousChannelId) {
        try {
          await api.getChannel(previousChannelId);
          channelId = previousChannelId;
        } catch (err) {
          console.warn(
            `[deal-alert-transport] Stored channel ${previousChannelId} is no longer accessible; recreating:`,
            describeError(err)
          );
        }
      }

      if (api.listChannels) {
        try {
          const existingChannels = await api.listChannels(channelGroupId);
          const matching = existingChannels.filter(
            (ch) => ch.name === channelName || ch.name === fallbackName
          );
          for (const ch of matching) {
            if (ch.id !== channelId) {
              try {
                await api.deleteChannel(ch.id);
              } catch (err) {
                console.warn(
                  `[deal-alert-transport] Could not delete duplicate channel ${ch.id}:`,
                  describeError(err)
                );
              }
            }
          }
        } catch (err) {
          console.warn(
            `[deal-alert-transport] Could not list channels in group ${channelGroupId}:`,
            describeError(err)
          );
        }
      }

      if (!channelId) {
        try {
          channelId = (
            await api.createChannel({
              channelGroupId,
              name: channelName,
              channelType,
              useChannelGroupPermission: true,
              accessRuleCreates: [],
            })
          ).id;
        } catch (err) {
          throw new Error(
            `Channel create failed (name="${channelName}", group="${channelGroupId}"): ${describeError(err)}`
          );
        }
      }

      verifiedChannels.add(channelId);
      const message = await api.createMessage({ channelId, content });
      return { channelId, messageId: message.id };
    },

    async delete(ref: DirectMessageRef) {
      for (const id of parseMessageIds(ref.messageId)) {
        try {
          await api.deleteMessage({ channelId: ref.channelId, id });
        } catch (err) {
          console.warn(
            `[deal-alert-transport] Could not delete message ${id} in channel ${ref.channelId}:`,
            describeError(err)
          );
        }
      }
    },

    async notify(recipient: string, summary: DealAlertNotificationSummary) {
      await api.sendNotification({
        userIds: [recipient],
        title: summary.title,
        description: summary.description,
      });
    },
  };
}
