import {
  ChannelType,
  rootServer,
  type ChannelGroupGuid,
} from "@rootsdk/server-app";
import { type RootCommunityConfig } from "./community-config";
import { checkIsCommunityAdmin } from "./community-admin";
import {
  provisionCommunityChannels,
  MARKET_CHANNEL_NAME,
} from "./setup-provisioning";
import type {
  AdminSettingsResponse,
  CommunityChannelOption,
  ProvisionMarketChannelsResponse,
  SetBroadcastChannelRequest,
  SetBroadcastChannelResponse,
} from "@ga/gen-shared";

export interface AdminRpcHelperDeps {
  isCommunityAdmin?: (userId: string) => Promise<boolean>;
  listChannelGroups?: () => Promise<Array<{ id: unknown; name: string }>>;
  listChannels?: (params: {
    channelGroupId: ChannelGroupGuid;
  }) => Promise<Array<{ id: unknown; name: string; channelType: number }>>;
  config?: RootCommunityConfig;
  provisionChannels?: () => Promise<{ marketChannel: string; assistantChannel: string }>;
}

async function checkAdmin(
  userId: string,
  deps: AdminRpcHelperDeps
): Promise<boolean> {
  const isAdminCheck = deps.isCommunityAdmin ?? checkIsCommunityAdmin;
  return isAdminCheck(userId);
}

export async function fetchCommunityTextChannels(
  deps: AdminRpcHelperDeps = {}
): Promise<CommunityChannelOption[]> {
  const listGroups =
    deps.listChannelGroups ?? (() => rootServer.community.channelGroups.list());
  const listChannels =
    deps.listChannels ??
    ((p) => rootServer.community.channels.list(p));

  const groups = await listGroups();
  const textChannels: CommunityChannelOption[] = [];

  for (const group of groups) {
    const groupChannels = await listChannels({
      channelGroupId: group.id as unknown as ChannelGroupGuid,
    });
    for (const ch of groupChannels) {
      if (ch.channelType === ChannelType.Text) {
        textChannels.push({
          id: String(ch.id),
          name: ch.name,
          groupName: group.name,
        });
      }
    }
  }

  return textChannels;
}

export async function getAdminSettingsHelper(
  userId: string,
  config: RootCommunityConfig,
  deps: AdminRpcHelperDeps = {}
): Promise<AdminSettingsResponse> {
  if (!(await checkAdmin(userId, deps))) {
    return {
      isAdmin: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      textChannels: [],
    };
  }

  const [broadcastChannelId, textChannels] = await Promise.all([
    config.getBroadcastChannelId(),
    fetchCommunityTextChannels(deps),
  ]);

  const activeChannel = broadcastChannelId
    ? textChannels.find((ch) => ch.id === broadcastChannelId)
    : undefined;

  return {
    isAdmin: true,
    broadcastChannelId: broadcastChannelId ?? "",
    broadcastChannelName: activeChannel?.name ?? "",
    textChannels,
  };
}

export async function setBroadcastChannelHelper(
  userId: string,
  request: SetBroadcastChannelRequest,
  config: RootCommunityConfig,
  deps: AdminRpcHelperDeps = {}
): Promise<SetBroadcastChannelResponse> {
  if (!(await checkAdmin(userId, deps))) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      error: "FORBIDDEN",
    };
  }

  const targetChannelId = (request.channelId || "").trim();
  if (!targetChannelId) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      error: "INVALID_CHANNEL",
    };
  }

  const textChannels = await fetchCommunityTextChannels(deps);
  const matched = textChannels.find((ch) => ch.id === targetChannelId);

  if (!matched) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      error: "CHANNEL_NOT_FOUND",
    };
  }

  await config.setBroadcastChannelId(targetChannelId);

  return {
    success: true,
    broadcastChannelId: targetChannelId,
    broadcastChannelName: matched.name,
    error: "",
  };
}

export async function provisionMarketChannelsHelper(
  userId: string,
  config: RootCommunityConfig,
  deps: AdminRpcHelperDeps = {}
): Promise<ProvisionMarketChannelsResponse> {
  if (!(await checkAdmin(userId, deps))) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      assistantChannelId: "",
      error: "FORBIDDEN",
    };
  }

  if (deps.provisionChannels) {
    await deps.provisionChannels();
  } else {
    await provisionCommunityChannels({ rootServer, config });
  }

  const [broadcastChannelId, assistantChannelId] = await Promise.all([
    config.getBroadcastChannelId(),
    config.getAssistantChannelId(),
  ]);

  return {
    success: true,
    broadcastChannelId: broadcastChannelId ?? "",
    broadcastChannelName: MARKET_CHANNEL_NAME,
    assistantChannelId: assistantChannelId ?? "",
    error: "",
  };
}
