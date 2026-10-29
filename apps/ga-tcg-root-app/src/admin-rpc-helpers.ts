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

async function resolveIsAdmin(
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
  const broadcastLocale = (await config.getBroadcastLocale?.()) ?? "en";

  if (!(await resolveIsAdmin(userId, deps))) {
    return {
      isAdmin: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      textChannels: [],
      broadcastLocale,
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
    broadcastLocale: broadcastLocale ?? "en",
  };
}

export async function setBroadcastChannelHelper(
  userId: string,
  request: SetBroadcastChannelRequest,
  config: RootCommunityConfig,
  deps: AdminRpcHelperDeps = {}
): Promise<SetBroadcastChannelResponse> {
  const currentLocale = (await config.getBroadcastLocale?.()) ?? "en";

  if (!(await resolveIsAdmin(userId, deps))) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      broadcastLocale: currentLocale,
      error: "FORBIDDEN",
    };
  }

  const targetChannelId = (request.channelId || "").trim();
  const rawLocale = (request.broadcastLocale || "").trim();
  const hasLocale = rawLocale === "en" || rawLocale === "pt-BR";

  if (!targetChannelId && !hasLocale) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      broadcastLocale: currentLocale,
      error: "INVALID_CHANNEL",
    };
  }

  let finalChannelId = await config.getBroadcastChannelId();
  let finalChannelName = "";

  if (targetChannelId) {
    const textChannels = await fetchCommunityTextChannels(deps);
    const matched = textChannels.find((ch) => ch.id === targetChannelId);

    if (!matched) {
      return {
        success: false,
        broadcastChannelId: "",
        broadcastChannelName: "",
        broadcastLocale: currentLocale,
        error: "CHANNEL_NOT_FOUND",
      };
    }

    await config.setBroadcastChannelId(targetChannelId);
    finalChannelId = targetChannelId;
    finalChannelName = matched.name;
  } else if (finalChannelId) {
    const textChannels = await fetchCommunityTextChannels(deps);
    finalChannelName = textChannels.find((ch) => ch.id === finalChannelId)?.name ?? "";
  }

  if (hasLocale && config.setBroadcastLocale) {
    await config.setBroadcastLocale(rawLocale as "en" | "pt-BR");
  }

  const updatedLocale = (await config.getBroadcastLocale?.()) ?? currentLocale;

  return {
    success: true,
    broadcastChannelId: finalChannelId ?? "",
    broadcastChannelName: finalChannelName,
    broadcastLocale: updatedLocale,
    error: "",
  };
}

export async function provisionMarketChannelsHelper(
  userId: string,
  config: RootCommunityConfig,
  deps: AdminRpcHelperDeps = {}
): Promise<ProvisionMarketChannelsResponse> {
  if (!(await resolveIsAdmin(userId, deps))) {
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
