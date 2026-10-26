import {
  findCollectorByIdentity,
  findIdentitiesWithNotificationsEnabled,
} from "../db/repositories/assistant-repository";
import {
  deleteDealAlertMessage,
  getDealAlertMessage,
  upsertDealAlertMessage,
} from "../db/repositories/deal-alert-repository";
import { getMarketStoreById } from "../db/repositories/marketplace-repository";
import {
  getUndeliveredNotifications,
  markNotificationsDelivered,
} from "../db/repositories/notification-delivery-repository";
import { setWantlistNotificationPreference } from "../db/repositories/personal-wants-repository";
import {
  linkRootCommunityIdentity,
  listRootCommunityIdentities,
} from "../db/repositories/root-community-identity-repository";
import { revokeRootBotInstall } from "../db/repositories/root-bot-install-repository";
import { parseMessageIds } from "./discord-dm-client";
import { ROOT_MESSAGE_MAX_BYTES } from "../lib/market-vocabulary";
import {
  planDealAlerts,
  type DealAlertPlanResult,
} from "./deal-alert-planner";
import {
  formatMarketNotificationChunks,
  groupMarketNotificationsByStore,
} from "./market-notification-message";
import { rootBotDestination } from "./root-bot-scope";

export interface RootBotMarketChunk {
  storeId: string;
  storeName: string;
  content: string;
  notificationIds: string[];
}

export interface RootBotDealAlertDelivery {
  recipientId: string;
  channelId: string;
  messageIds: string[];
  lastListingKeys: string[];
}

export interface RootBotCollector {
  collectorId: string;
  collectorName: string | null;
  friendCode?: string | null;
  notificationsEnabled?: boolean;
  dealAlertMode?: "all" | "hard";
}

/** Pending marketplace notifications, grouped by store and formatted. */
export async function listPendingMarketChunks(
  communityId: string
): Promise<RootBotMarketChunk[]> {
  const pending = await getUndeliveredNotifications(
    rootBotDestination(communityId)
  );
  if (pending.length === 0) {
    return [];
  }

  const byStore = groupMarketNotificationsByStore(pending);
  const chunks: RootBotMarketChunk[] = [];

  for (const [storeId, notifications] of byStore) {
    const store = await getMarketStoreById(storeId);
    const storeName = store?.name ?? storeId;

    for (const chunk of formatMarketNotificationChunks(
      notifications,
      storeName,
      store?.lastFullScanAt ?? null,
      ROOT_MESSAGE_MAX_BYTES,
      store?.baseUrl ?? null,
      true
    )) {
      chunks.push({
        storeId,
        storeName,
        content: chunk.content,
        notificationIds: chunk.notificationIds,
      });
    }
  }

  return chunks;
}

export async function markMarketChunksDelivered(
  communityId: string,
  notificationIds: string[],
  messageIds: string[]
): Promise<void> {
  await markNotificationsDelivered(
    notificationIds,
    rootBotDestination(communityId),
    messageIds.join(",")
  );
}

/** Changed deal-alert lists for members of this community, plus cleanup. */
export async function planCommunityDealAlerts(
  communityId: string
): Promise<DealAlertPlanResult> {
  const memberIds = new Set(
    await listRootCommunityIdentities(communityId)
  );
  const identities =
    memberIds.size > 0
      ? await findIdentitiesWithNotificationsEnabled("root")
      : [];
  const keepRecipients = new Set(
    identities
      .filter((identity) => memberIds.has(identity.providerUserId))
      .map((identity) => identity.providerUserId)
  );

  return planDealAlerts(undefined, {
    destination: rootBotDestination(communityId),
    keepRecipients,
    recipientIds: memberIds,
  });
}

export async function recordCommunityDealAlertDelivery(
  communityId: string,
  delivery: RootBotDealAlertDelivery
): Promise<void> {
  await upsertDealAlertMessage({
    destination: rootBotDestination(communityId),
    recipientId: delivery.recipientId,
    channelId: delivery.channelId,
    messageId: delivery.messageIds.join(","),
    lastListingKeys: JSON.stringify(delivery.lastListingKeys),
    updatedAt: new Date(),
  });
}

export async function clearCommunityDealAlert(
  communityId: string,
  recipientId: string
): Promise<void> {
  await deleteDealAlertMessage(
    rootBotDestination(communityId),
    recipientId
  );
}

export async function getCommunityDealAlertChannel(
  communityId: string,
  recipientId: string
): Promise<{ channelId: string; messageIds: string[] } | null> {
  const row = await getDealAlertMessage(
    rootBotDestination(communityId),
    recipientId
  );
  if (!row) {
    return null;
  }

  return { channelId: row.channelId, messageIds: parseMessageIds(row.messageId) };
}

export async function resolveCommunityCollector(
  communityId: string,
  providerUserId: string
): Promise<RootBotCollector | null> {
  const resolved = await findCollectorByIdentity("root", providerUserId);
  if (!resolved) {
    return null;
  }

  await linkRootCommunityIdentity(communityId, providerUserId);
  const result: RootBotCollector = {
    collectorId: resolved.collector.id,
    collectorName: resolved.collector.name,
  };
  if (resolved.collector.friendCode) {
    result.friendCode = resolved.collector.friendCode;
  }
  if (resolved.identity?.wantlistNotificationsEnabled !== undefined) {
    result.notificationsEnabled = Boolean(resolved.identity.wantlistNotificationsEnabled);
  }
  if (resolved.identity?.dealAlertMode) {
    result.dealAlertMode = resolved.identity.dealAlertMode as "all" | "hard";
  }
  return result;
}

/** Returns false when the Root identity has not linked a collector. */
export async function setCommunityNotifyPreference(
  communityId: string,
  providerUserId: string,
  enabled: boolean,
  mode?: "all" | "hard"
): Promise<boolean> {
  const resolved = await findCollectorByIdentity("root", providerUserId);
  if (!resolved) {
    return false;
  }

  await linkRootCommunityIdentity(communityId, providerUserId);
  await setWantlistNotificationPreference(
    resolved.collector.id,
    "root",
    enabled,
    ...(mode !== undefined ? [mode] : [])
  );
  return true;
}

export async function noteRootCommunityMember(
  communityId: string,
  providerUserId: string
): Promise<void> {
  await linkRootCommunityIdentity(communityId, providerUserId);
}

export async function revokeCommunityInstall(
  appId: string,
  communityId: string
): Promise<void> {
  await revokeRootBotInstall(appId, communityId);
}
