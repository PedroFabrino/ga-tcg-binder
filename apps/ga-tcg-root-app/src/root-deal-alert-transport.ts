import {
  rootServer,
  ChannelType,
  WellKnownRootGuids,
  type ChannelGuid,
  type ChannelGroupGuid,
  type MessageGuid,
  type RoleOrMemberGuid,
  type UserGuid,
} from "@rootsdk/server-bot";
import type {
  DirectMessageRef,
  DirectMessageSink,
} from "../../../src/services/market-notification-sink";
import type { DealAlertNotificationSummary } from "../../../src/services/deal-alert-format";

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
  createChannel(request: {
    channelGroupId: string;
    name: string;
    channelType: number;
    useChannelGroupPermission: boolean;
    accessRuleCreates: RootDealAlertAccessRule[];
  }): Promise<{ id: string }>;
  createMessage(request: {
    channelId: string;
    content: string;
  }): Promise<{ id: string }>;
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
  return {
    everyoneRoleId: String(WellKnownRootGuids.CommunityRoles.EveryoneRole),
    async createChannel(request) {
      const channel = await root.community.channels.create({
        channelGroupId: request.channelGroupId as ChannelGroupGuid,
        name: request.name,
        channelType: request.channelType,
        useChannelGroupPermission: request.useChannelGroupPermission,
        accessRuleCreates: request.accessRuleCreates.map((rule) => ({
          roleOrMemberId: rule.roleOrMemberId as RoleOrMemberGuid,
          overlay: rule.overlay,
        })),
      });
      return { id: String(channel.id) };
    },
    async createMessage(request) {
      const message = await root.community.channelMessages.create({
        channelId: request.channelId as ChannelGuid,
        content: request.content,
      });
      return { id: String(message.id) };
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

function channelNameForRecipient(recipient: string): string {
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
  return {
    async send(recipient, content, previousChannelId) {
      const channelId =
        previousChannelId ??
        (
          await api.createChannel({
            channelGroupId,
            name: channelNameForRecipient(recipient),
            channelType,
            useChannelGroupPermission: false,
            accessRuleCreates: [
              {
                roleOrMemberId: api.everyoneRoleId,
                overlay: { channelView: false },
              },
              {
                roleOrMemberId: recipient,
                overlay: {
                  channelView: true,
                  channelCreateMessage: true,
                  channelViewMessageHistory: true,
                },
              },
            ],
          })
        ).id;

      const message = await api.createMessage({ channelId, content });
      return { channelId, messageId: message.id };
    },

    async delete(ref: DirectMessageRef) {
      const ids = ref.messageId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      for (const id of ids) {
        await api.deleteMessage({ channelId: ref.channelId, id });
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
