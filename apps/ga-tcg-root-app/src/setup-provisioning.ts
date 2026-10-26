import {
  ChannelType,
  type ChannelGroupGuid,
  type RoleOrMemberGuid,
} from "@rootsdk/server-bot";
import { type RootCommunityConfig } from "./community-config";

export const MARKET_CHANNEL_NAME = "market";
export const ASSISTANT_CHANNEL_NAME = "assistant";
export const GROUP_NAME = "GA Market";

export interface ProvisioningContext {
  rootServer: {
    appId: unknown;
    community: {
      channelGroups: {
        create(params: {
          name: string;
          accessRuleCreates: Array<{
            roleOrMemberId: RoleOrMemberGuid;
            overlay: { channelFullControl: boolean };
          }>;
        }): Promise<{ id: string | number }>;
      };
      channels: {
        create(params: {
          channelGroupId: ChannelGroupGuid;
          name: string;
          channelType: number;
          useChannelGroupPermission: boolean;
        }): Promise<{ id: string | number }>;
      };
    };
  };
  config: RootCommunityConfig;
}

export async function provisionCommunityChannels(
  ctx: ProvisioningContext
): Promise<{
  marketChannel: string;
  assistantChannel: string;
}> {
  const { rootServer, config } = ctx;

  let [sectionId, broadcastId, assistantId] = await Promise.all([
    config.getAlertSectionId(),
    config.getBroadcastChannelId(),
    config.getAssistantChannelId(),
  ]);

  if (!sectionId) {
    const group = await rootServer.community.channelGroups.create({
      name: GROUP_NAME,
      accessRuleCreates: [
        {
          roleOrMemberId: String(rootServer.appId) as RoleOrMemberGuid,
          overlay: { channelFullControl: true },
        },
      ],
    });
    sectionId = String(group.id);
    await config.setAlertSectionId(sectionId);
  }

  if (!broadcastId) {
    const created = await rootServer.community.channels.create({
      channelGroupId: sectionId as unknown as ChannelGroupGuid,
      name: MARKET_CHANNEL_NAME,
      channelType: ChannelType.Text,
      useChannelGroupPermission: true,
    });
    broadcastId = String(created.id);
    await config.setBroadcastChannelId(broadcastId);
  }

  if (!assistantId) {
    const createdApp = await rootServer.community.channels.create({
      channelGroupId: sectionId as unknown as ChannelGroupGuid,
      name: ASSISTANT_CHANNEL_NAME,
      channelType: ChannelType.App,
      useChannelGroupPermission: true,
    });
    assistantId = String(createdApp.id);
    await config.setAssistantChannelId(assistantId);
  }

  return {
    marketChannel: MARKET_CHANNEL_NAME,
    assistantChannel: ASSISTANT_CHANNEL_NAME,
  };
}
