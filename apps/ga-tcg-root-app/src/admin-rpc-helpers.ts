import {
  ChannelType,
  rootServer,
  type ChannelGroupGuid,
  type ChannelGuid,
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
  CommunityChannelGroupOption,
  ProvisionMarketChannelsRequest,
  ProvisionMarketChannelsResponse,
  SetBroadcastChannelRequest,
  SetBroadcastChannelResponse,
} from "@ga/gen-shared";

export interface AdminRpcHelperDeps {
  isCommunityAdmin?: (userId: string) => Promise<boolean>;
  listChannelGroups?: () => Promise<Array<{ id: unknown; name: string }>>;
  getChannelGroup?: (params: {
    id: ChannelGroupGuid;
  }) => Promise<{ id: unknown; name: string } | undefined>;
  listChannels?: (params: {
    channelGroupId: ChannelGroupGuid;
  }) => Promise<Array<{ id: unknown; name: string; channelType: number }>>;
  getChannel?: (params: {
    id: ChannelGuid;
  }) => Promise<{ id: unknown; name: string; channelType?: number } | undefined>;
  config?: RootCommunityConfig;
  provisionChannels?: (targetGroupId?: string) => Promise<{ marketChannel: string; assistantChannel: string }>;
}

async function resolveIsAdmin(
  userId: string,
  deps: AdminRpcHelperDeps
): Promise<boolean> {
  const isAdminCheck = deps.isCommunityAdmin ?? checkIsCommunityAdmin;
  return isAdminCheck(userId);
}

export async function fetchCommunityChannelGroups(
  deps: AdminRpcHelperDeps = {}
): Promise<CommunityChannelGroupOption[]> {
  const listGroups =
    deps.listChannelGroups ?? (() => rootServer.community.channelGroups.list());
  const getGroup =
    deps.getChannelGroup ??
    (typeof rootServer.community.channelGroups?.get === "function"
      ? (p) => rootServer.community.channelGroups.get(p)
      : undefined);

  let groupList: CommunityChannelGroupOption[] = [];
  try {
    const groups = (await listGroups()) || [];
    groupList = groups.map((g) => ({ id: String(g.id), name: g.name }));
  } catch (err) {
    console.warn("Failed to list channel groups:", err);
  }

  // If config has an alertSectionId not returned in list, attempt direct resolution
  if (deps.config?.getAlertSectionId && getGroup) {
    try {
      const storedSectionId = await deps.config.getAlertSectionId();
      if (storedSectionId && !groupList.some((g) => g.id === storedSectionId)) {
        const directGroup = await getGroup({
          id: storedSectionId as unknown as ChannelGroupGuid,
        });
        if (directGroup?.name) {
          groupList.push({
            id: String(directGroup.id),
            name: directGroup.name,
          });
        }
      }
    } catch {
      // Stale or inaccessible stored group ID
    }
  }

  return groupList;
}

export async function fetchCommunityTextChannels(
  deps: AdminRpcHelperDeps = {}
): Promise<CommunityChannelOption[]> {
  const groups = await fetchCommunityChannelGroups(deps);
  const listChannels =
    deps.listChannels ?? ((p) => rootServer.community.channels.list(p));
  const getChannel =
    deps.getChannel ??
    (typeof rootServer.community.channels?.get === "function"
      ? (p) => rootServer.community.channels.get(p)
      : undefined);

  const textChannels: CommunityChannelOption[] = [];
  const seenIds = new Set<string>();

  for (const group of groups) {
    try {
      const groupChannels = (await listChannels({
        channelGroupId: group.id as unknown as ChannelGroupGuid,
      })) || [];
      for (const ch of groupChannels) {
        if (ch.channelType === ChannelType.Text) {
          const idStr = String(ch.id);
          if (!seenIds.has(idStr)) {
            seenIds.add(idStr);
            textChannels.push({
              id: idStr,
              name: ch.name,
              groupName: group.name,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to list channels for group ${group.name}:`, err);
    }
  }

  // If broadcast channel is stored in config but not yet seen, attempt direct resolution
  if (deps.config?.getBroadcastChannelId && getChannel) {
    try {
      const storedBroadcastId = await deps.config.getBroadcastChannelId();
      if (storedBroadcastId && !seenIds.has(storedBroadcastId)) {
        const directCh = await getChannel({
          id: storedBroadcastId as unknown as ChannelGuid,
        });
        if (
          directCh &&
          (directCh.channelType === undefined ||
            directCh.channelType === ChannelType.Text)
        ) {
          textChannels.push({
            id: String(directCh.id),
            name: directCh.name,
            groupName: "",
          });
        }
      }
    } catch {
      // Stale broadcast channel
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
      channelGroups: [],
      alertSectionId: "",
      alertSectionName: "",
    };
  }

  const depsWithConfig: AdminRpcHelperDeps = { ...deps, config };

  const [rawBroadcastChannelId, rawAlertSectionId, textChannels, channelGroups] =
    await Promise.all([
      config.getBroadcastChannelId?.() ?? Promise.resolve(undefined),
      config.getAlertSectionId?.() ?? Promise.resolve(undefined),
      fetchCommunityTextChannels(depsWithConfig),
      fetchCommunityChannelGroups(depsWithConfig),
    ]);

  const activeChannel = rawBroadcastChannelId
    ? textChannels.find((ch) => ch.id === rawBroadcastChannelId)
    : undefined;

  const activeGroup = rawAlertSectionId
    ? channelGroups.find((g) => g.id === rawAlertSectionId)
    : undefined;

  // If stored IDs cannot be found in resolved channels/groups, clear dead config
  const broadcastChannelId = activeChannel ? rawBroadcastChannelId : "";
  const alertSectionId = activeGroup ? rawAlertSectionId : "";

  return {
    isAdmin: true,
    broadcastChannelId: broadcastChannelId ?? "",
    broadcastChannelName: activeChannel?.name ?? "",
    textChannels,
    broadcastLocale: broadcastLocale ?? "en",
    channelGroups,
    alertSectionId: alertSectionId ?? "",
    alertSectionName: activeGroup?.name ?? "",
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
      alertSectionId: "",
      alertSectionName: "",
      error: "FORBIDDEN",
    };
  }

  const targetChannelId = (request.channelId || "").trim();
  const targetGroupId = (request.channelGroupId || "").trim();
  const rawLocale = (request.broadcastLocale || "").trim();
  const hasLocale = rawLocale === "en" || rawLocale === "pt-BR";

  if (!targetChannelId && !targetGroupId && !hasLocale) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      broadcastLocale: currentLocale,
      alertSectionId: "",
      alertSectionName: "",
      error: "INVALID_CHANNEL",
    };
  }

  const depsWithConfig: AdminRpcHelperDeps = { ...deps, config };

  let finalGroupId = (await config.getAlertSectionId?.()) ?? "";
  let finalGroupName = "";

  if (targetGroupId) {
    const groups = await fetchCommunityChannelGroups(depsWithConfig);
    const matchedGroup = groups.find((g) => g.id === targetGroupId);
    if (matchedGroup) {
      if (config.setAlertSectionId) {
        await config.setAlertSectionId(targetGroupId);
      }
      finalGroupId = targetGroupId;
      finalGroupName = matchedGroup.name;
    }
  } else if (finalGroupId) {
    const groups = await fetchCommunityChannelGroups(depsWithConfig);
    finalGroupName = groups.find((g) => g.id === finalGroupId)?.name ?? "";
  }

  let finalChannelId = await config.getBroadcastChannelId();
  let finalChannelName = "";

  if (targetChannelId) {
    const textChannels = await fetchCommunityTextChannels(depsWithConfig);
    const matched = textChannels.find((ch) => ch.id === targetChannelId);

    if (!matched) {
      return {
        success: false,
        broadcastChannelId: "",
        broadcastChannelName: "",
        broadcastLocale: currentLocale,
        alertSectionId: finalGroupId ?? "",
        alertSectionName: finalGroupName,
        error: "CHANNEL_NOT_FOUND",
      };
    }

    await config.setBroadcastChannelId(targetChannelId);
    finalChannelId = targetChannelId;
    finalChannelName = matched.name;
  } else if (finalChannelId) {
    const textChannels = await fetchCommunityTextChannels(depsWithConfig);
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
    alertSectionId: finalGroupId ?? "",
    alertSectionName: finalGroupName,
    error: "",
  };
}

export async function provisionMarketChannelsHelper(
  userId: string,
  config: RootCommunityConfig,
  request: ProvisionMarketChannelsRequest = { channelGroupId: "" },
  deps: AdminRpcHelperDeps = {}
): Promise<ProvisionMarketChannelsResponse> {
  if (!(await resolveIsAdmin(userId, deps))) {
    return {
      success: false,
      broadcastChannelId: "",
      broadcastChannelName: "",
      assistantChannelId: "",
      alertSectionId: "",
      alertSectionName: "",
      error: "FORBIDDEN",
    };
  }

  const targetGroupId = (request.channelGroupId || "").trim();

  if (deps.provisionChannels) {
    await deps.provisionChannels(targetGroupId || undefined);
  } else {
    await provisionCommunityChannels({
      rootServer,
      config,
      targetGroupId: targetGroupId || undefined,
    });
  }

  const depsWithConfig: AdminRpcHelperDeps = { ...deps, config };

  const [broadcastChannelId, alertSectionId, channelGroups] = await Promise.all([
    config.getBroadcastChannelId(),
    config.getAlertSectionId(),
    fetchCommunityChannelGroups(depsWithConfig),
  ]);

  const activeGroup = alertSectionId
    ? channelGroups.find((g) => g.id === alertSectionId)
    : undefined;

  return {
    success: true,
    broadcastChannelId: broadcastChannelId ?? "",
    broadcastChannelName: MARKET_CHANNEL_NAME,
    assistantChannelId: "",
    alertSectionId: alertSectionId ?? "",
    alertSectionName: activeGroup?.name ?? "",
    error: "",
  };
}
