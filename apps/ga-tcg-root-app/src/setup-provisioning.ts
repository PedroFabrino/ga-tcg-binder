import {
  ChannelType,
  type ChannelGroupGuid,
  type RoleOrMemberGuid,
} from "@rootsdk/server-app";
import { type RootCommunityConfig } from "./community-config";

export const MARKET_CHANNEL_NAME = "market";
export const GROUP_NAME = "GA Market";

export interface ProvisioningContext {
  rootServer: {
    appId: unknown;
    community: {
      channelGroups: {
        list?(): Promise<Array<{ id: string | number; name: string }>>;
        create(params: {
          name: string;
          accessRuleCreates?: Array<{
            roleOrMemberId: RoleOrMemberGuid;
            overlay: { channelFullControl: boolean };
          }>;
        }): Promise<{ id: string | number }>;
      };
      channels: {
        list?(params: {
          channelGroupId: ChannelGroupGuid;
        }): Promise<Array<{ id: string | number; name: string; channelType?: number }>>;
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
  targetGroupId?: string;
}

export async function provisionCommunityChannels(
  ctx: ProvisioningContext
): Promise<{
  marketChannel: string;
  assistantChannel: string;
}> {
  const { rootServer, config, targetGroupId } = ctx;

  let sectionId = targetGroupId || (await config.getAlertSectionId());
  let broadcastId = await config.getBroadcastChannelId();

  // If sectionId is not specified or configured, search for existing GA Market group before creating a new one
  if (!sectionId) {
    if (typeof rootServer.community.channelGroups.list === "function") {
      try {
        const groups = await rootServer.community.channelGroups.list();
        const existingGroup = groups.find(
          (g) => g.name.trim().toLowerCase() === GROUP_NAME.toLowerCase()
        );
        if (existingGroup) {
          sectionId = String(existingGroup.id);
        }
      } catch (err) {
        console.warn("Failed to check existing channel groups:", err);
      }
    }
  }

  // If still no sectionId, create a single GA Market group
  if (!sectionId) {
    const group = await rootServer.community.channelGroups.create({
      name: GROUP_NAME,
    });
    sectionId = String(group.id);
  }
  await config.setAlertSectionId(sectionId);

  // Check if a market channel already exists in sectionId
  if (!broadcastId && typeof rootServer.community.channels.list === "function") {
    try {
      const channels = await rootServer.community.channels.list({
        channelGroupId: sectionId as unknown as ChannelGroupGuid,
      });
      const existingMarket = channels.find(
        (ch) => ch.name.trim().toLowerCase() === MARKET_CHANNEL_NAME.toLowerCase()
      );
      if (existingMarket) {
        broadcastId = String(existingMarket.id);
      }
    } catch (err) {
      console.warn("Failed to check existing channels in section:", err);
    }
  }

  // Create market text channel if not yet present
  if (!broadcastId) {
    const created = await rootServer.community.channels.create({
      channelGroupId: sectionId as unknown as ChannelGroupGuid,
      name: MARKET_CHANNEL_NAME,
      channelType: ChannelType.Text,
      useChannelGroupPermission: true,
    });
    broadcastId = String(created.id);
  }
  await config.setBroadcastChannelId(broadcastId);

  // Note: We deliberately do NOT create an empty ChannelType.App "assistant" channel here.
  // Root already mounts the assistant in the community dock (GA-Assistant).
  return {
    marketChannel: MARKET_CHANNEL_NAME,
    assistantChannel: "",
  };
}
