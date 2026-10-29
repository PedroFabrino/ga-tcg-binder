import {
  ChannelType,
  type ChannelGroupGuid,
  type ChannelGuid,
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
        get?(params: { id: ChannelGroupGuid }): Promise<{ id: string | number; name: string }>;
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
        get?(params: { id: ChannelGuid }): Promise<{ id: string | number; name: string }>;
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

  // If sectionId was loaded from config (not an explicit targetGroupId), verify it is accessible
  if (sectionId && !targetGroupId) {
    let isValid = false;
    if (typeof rootServer.community.channelGroups?.get === "function") {
      try {
        await rootServer.community.channelGroups.get({
          id: sectionId as unknown as ChannelGroupGuid,
        });
        isValid = true;
      } catch {
        isValid = false;
      }
    } else if (typeof rootServer.community.channelGroups?.list === "function") {
      try {
        const groups = await rootServer.community.channelGroups.list();
        isValid = groups.length === 0 || groups.some((g) => String(g.id) === sectionId);
      } catch {
        isValid = true;
      }
    } else {
      isValid = true;
    }

    if (!isValid) {
      sectionId = undefined;
      await config.setAlertSectionId("");
    }
  }

  // If sectionId is not specified or configured, search for existing GA Market group before creating a new one
  if (!sectionId) {
    if (typeof rootServer.community.channelGroups?.list === "function") {
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

  // If still no sectionId, create a single clean public GA Market group (no accessRuleCreates)
  if (!sectionId) {
    const group = await rootServer.community.channelGroups.create({
      name: GROUP_NAME,
    });
    sectionId = String(group.id);
  }
  await config.setAlertSectionId(sectionId);

  // If broadcastId was loaded from config, verify it is accessible
  if (broadcastId && typeof rootServer.community.channels?.get === "function") {
    try {
      await rootServer.community.channels.get({
        id: broadcastId as unknown as ChannelGuid,
      });
    } catch {
      broadcastId = undefined;
      await config.setBroadcastChannelId("");
    }
  }

  // Check if a market channel already exists in sectionId
  if (!broadcastId && typeof rootServer.community.channels?.list === "function") {
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
