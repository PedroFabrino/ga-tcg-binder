import {
  rootServer,
  type ChannelGuid,
  type JobScheduler,
} from "@rootsdk/server-bot";
import {
  createCommunityConfig,
  type RootCommunityConfig,
} from "./community-config";
import { RootBotApi } from "./root-bot-api";
import { scheduleRootBotPolling } from "./root-bot-scheduler";
import { describeError } from "./describe-error";

export interface MarketNotificationPollDeps {
  api: Pick<
    RootBotApi,
    "getMarketNotifications" | "markMarketNotificationsDelivered"
  >;
  config: Pick<RootCommunityConfig, "getBroadcastChannelId">;
  postMessage: (channelId: string, content: string) => Promise<string | null>;
  warn?: (message: string) => void;
}

/**
 * One market-notification poll: pull pending chunks from the API, post them to
 * the `/setup` channel, and report each delivered chunk. Stops on the first
 * failed post so the remainder is retried on the next poll.
 */
export async function runMarketNotificationPoll(
  deps: MarketNotificationPollDeps
): Promise<void> {
  const broadcastChannelId = await deps.config.getBroadcastChannelId();
  if (!broadcastChannelId) {
    deps.warn?.(
      "No broadcast channel configured — run /setup in the target channel. Market notifications paused."
    );
    return;
  }

  const { chunks } = await deps.api.getMarketNotifications();

  for (const chunk of chunks) {
    const messageId = await deps.postMessage(broadcastChannelId, chunk.content);

    // A thrown post leaves the chunk unrecorded, so the next poll retries it.
    // A successful post with no id is recorded anyway to avoid duplicates.
    if (!messageId) {
      deps.warn?.(
        "Posted a market chunk but received no message id; recording delivery to avoid duplicates."
      );
    }

    await deps.api.markMarketNotificationsDelivered({
      notificationIds: chunk.notificationIds,
      messageIds: messageId ? [messageId] : [],
    });
  }
}

export interface MarketNotifierOptions {
  communityId?: string;
  api?: RootBotApi;
  config?: RootCommunityConfig;
  intervalMs?: number;
  scheduler?: JobScheduler;
  postMessage?: (channelId: string, content: string) => Promise<string | null>;
}

/**
 * Starts the market-notification poller on Root's job scheduler. The broadcast
 * channel comes from per-community config (`/setup`); all data comes from the
 * API, so the bot holds no database or Discord secrets.
 */
export async function startMarketNotifier(
  options: MarketNotifierOptions = {}
): Promise<void> {
  const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
  const api = options.api ?? new RootBotApi({ communityId });
  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);
  const postMessage =
    options.postMessage ??
    (async (channelId, content) => {
      const message = await rootServer.community.channelMessages.create({
        channelId: channelId as unknown as ChannelGuid,
        content,
      });
      return message?.id ? String(message.id) : null;
    });

  await scheduleRootBotPolling({
    scheduler: options.scheduler ?? rootServer.jobScheduler,
    resourceId: "ga-market-notifications",
    tag: "market-notifications",
    intervalMs:
      options.intervalMs ??
      Number.parseInt(process.env.ROOT_BOT_POLL_INTERVAL_MS ?? "30000", 10),
    run: async () => {
      try {
        await runMarketNotificationPoll({ api, config, postMessage });
      } catch (err) {
        console.error(
          `[market-notifier] Poll error: ${describeError(err)}`
        );
      }
    },
  });
}
