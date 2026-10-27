import {
  rootServer,
  CommunityAppLogType,
  type ChannelGuid,
  type JobScheduler,
} from "@rootsdk/server-app";
import {
  createCommunityConfig,
  type RootCommunityConfig,
} from "./community-config";
import { RootBotApi } from "./root-bot-api";
import { scheduleRootBotPolling } from "./root-bot-scheduler";
import { reportDiagnostic } from "./diagnostics";

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
 * the configured broadcast channel, and report each delivered chunk. A thrown post leaves
 * the remainder for the next poll; a successful post without a message id is
 * still recorded so it is not re-sent.
 */
export async function runMarketNotificationPoll(
  deps: MarketNotificationPollDeps
): Promise<void> {
  const broadcastChannelId = await deps.config.getBroadcastChannelId();
  if (!broadcastChannelId) {
    deps.warn?.(
      "No broadcast channel configured — select a channel in the Assistant App GUI. Market notifications paused."
    );
    return;
  }

  const { chunks } = await deps.api.getMarketNotifications();

  for (const chunk of chunks) {
    const messageId = await deps.postMessage(broadcastChannelId, chunk.content);

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
 * Starts the market-notification poller. It runs one poll immediately, then
 * schedules subsequent polls on Root's job scheduler (with a local watchdog).
 * The broadcast channel comes from per-community config configured via the GUI; all data
 * comes from the API, so the app holds no database or Discord secrets.
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
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const message = await rootServer.community.channelMessages.create({
            channelId: channelId as unknown as ChannelGuid,
            content,
          });
          return message?.id ? String(message.id) : null;
        } catch (err) {
          lastError = err;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }
      throw new Error(
        `Message create failed (channel=${channelId}, contentLen=${content.length}, head=${content.slice(0, 40)}): ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`
      );
    });

  const intervalMs =
    options.intervalMs ??
    Number.parseInt(process.env.ROOT_BOT_POLL_INTERVAL_MS ?? "30000", 10);

  const run = async (): Promise<void> => {
    try {
      await runMarketNotificationPoll({ api, config, postMessage });
    } catch (err) {
      await reportDiagnostic({
        stage: "market-poll-failed",
        communityId,
        message: err,
        level: CommunityAppLogType.Error,
      });
    }
  };

  await run();

  await scheduleRootBotPolling({
    scheduler: options.scheduler ?? rootServer.jobScheduler,
    resourceId: "ga-market-notifications",
    tag: "market-notifications",
    intervalMs,
    run,
    onError: (err) => {
      void reportDiagnostic({
        stage: "market-scheduler-failed",
        communityId,
        message: err,
        level: CommunityAppLogType.Error,
      });
    },
  });
}
