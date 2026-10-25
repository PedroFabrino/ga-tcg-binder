import {
  getDealAlertMessage,
  listAllDealAlertMessages,
} from "../db/repositories/deal-alert-repository";
import {
  getMarketCards,
  type MarketplaceDatabase,
} from "../db/repositories/marketplace-repository";
import {
  formatDealAlertChunks,
  formatDealAlertNotificationSummary,
  hasListingChanges,
  matchKey,
  type DealAlertMatch,
  type DealAlertNotificationSummary,
} from "./deal-alert-format";
import {
  DISCORD_DM_DESTINATION,
  MESSAGE_MAX_LENGTH,
  ROOT_MESSAGE_MAX_BYTES,
} from "../lib/market-vocabulary";
import { parseMessageIds } from "./discord-dm-client";
import { matchDealAlerts } from "./discord-deal-notifier";

export interface DealAlertPlan {
  recipientId: string;
  /** Existing channel for this recipient, or null when it must be created. */
  channelId: string | null;
  previousMessageIds: string[];
  chunks: string[];
  summary: DealAlertNotificationSummary;
  lastListingKeys: string[];
}

export interface DealAlertCleanup {
  recipientId: string;
  channelId: string;
  messageIds: string[];
}

export interface DealAlertPlanResult {
  plans: DealAlertPlan[];
  cleanup: DealAlertCleanup[];
}

/**
 * Plans deal-alert delivery without sending anything: which recipients changed
 * (with formatted chunks + ping summary) and which stale recipients should be
 * cleaned up. Used by the Root bot API; delivery itself happens in the bot.
 */
export async function planDealAlerts(
  database?: MarketplaceDatabase,
  options: {
    /** State key; `root:<communityId>` is used for Root installs. */
    destination?: string;
    keepRecipients?: ReadonlySet<string>;
    /** Limit matching to these provider user ids (community scoping). */
    recipientIds?: ReadonlySet<string>;
    now?: Date;
  } = {}
): Promise<DealAlertPlanResult> {
  const destination = options.destination ?? DISCORD_DM_DESTINATION;
  const provider: "discord" | "root" = destination.startsWith("root")
    ? "root"
    : "discord";
  const now = options.now ?? new Date();

  const isRoot = provider === "root";

  const listings = await getMarketCards({ inStockOnly: true }, database);
  const matches = await matchDealAlerts(
    listings,
    database,
    provider,
    options.recipientIds
  );

  const byRecipient = new Map<string, DealAlertMatch[]>();
  for (const match of matches) {
    const list = byRecipient.get(match.recipientId);
    if (list) list.push(match);
    else byRecipient.set(match.recipientId, [match]);
  }

  const cleanup: DealAlertCleanup[] = [];
  const storedMessages = (await listAllDealAlertMessages(database)).filter(
    (row) => row.destination === destination
  );
  for (const stored of storedMessages) {
    if (
      !byRecipient.has(stored.recipientId) &&
      !options.keepRecipients?.has(stored.recipientId)
    ) {
      cleanup.push({
        recipientId: stored.recipientId,
        channelId: stored.channelId,
        messageIds: parseMessageIds(stored.messageId),
      });
    }
  }

  const plans: DealAlertPlan[] = [];
  for (const [recipientId, userMatches] of byRecipient) {
    const currentKeys = userMatches.map(matchKey);
    const stored = await getDealAlertMessage(destination, recipientId, database);

    if (!hasListingChanges(currentKeys, stored?.lastListingKeys)) {
      continue;
    }

    plans.push({
      recipientId,
      channelId: stored?.channelId ?? null,
      previousMessageIds: stored ? parseMessageIds(stored.messageId) : [],
      chunks: formatDealAlertChunks(userMatches, now, MESSAGE_MAX_LENGTH, {
        plainLinks: isRoot,
        maxBytes: isRoot ? ROOT_MESSAGE_MAX_BYTES : undefined,
      }),
      summary: formatDealAlertNotificationSummary(userMatches),
      lastListingKeys: currentKeys,
    });
  }

  return { plans, cleanup };
}
