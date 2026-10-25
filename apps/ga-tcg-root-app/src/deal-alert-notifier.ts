import {
  rootServer,
  CommunityAppLogType,
  type JobScheduler,
} from "@rootsdk/server-bot";
import type { DirectMessageRef, DirectMessageSink } from "./deal-alert-sink";
import {
  createCommunityConfig,
  type RootCommunityConfig,
} from "./community-config";
import { RootBotApi } from "./root-bot-api";
import { scheduleRootBotPolling } from "./root-bot-scheduler";
import { ensureAlertSection } from "./root-deal-alert-section";
import {
  createRootDealAlertTransport,
  createRootServerDealAlertApi,
  type RootDealAlertApi,
} from "./root-deal-alert-transport";
import { reportDiagnostic } from "./diagnostics";

const WELCOME_MESSAGE =
  "🔔 **Deal alerts are on.** I'll keep this channel updated with cards from your wantlist and deck shortages that are for sale.";

export interface DealAlertPollDeps {
  api: Pick<
    RootBotApi,
    "getDealAlerts" | "recordDealAlertDelivery" | "recordDealAlertCleanup"
  >;
  ensureSection: () => Promise<string>;
  createTransport: (sectionId: string) => DirectMessageSink;
}

/**
 * One deal-alert poll: ask the API for changed lists + cleanup, deliver to Root
 * channels/notifications, and report the results back. No matching or database
 * work happens in the bot.
 */
export async function runDealAlertPoll(
  deps: DealAlertPollDeps
): Promise<void> {
  const { plans, cleanup } = await deps.api.getDealAlerts();
  const sectionId = await deps.ensureSection();
  const transport = deps.createTransport(sectionId);

  for (const item of cleanup) {
    for (const id of item.messageIds) {
      await transport.delete({ channelId: item.channelId, messageId: id });
    }
    await deps.api.recordDealAlertCleanup(item.recipientId);
  }

  for (const plan of plans) {
    const sentRefs: DirectMessageRef[] = [];
    let channelId = plan.channelId ?? undefined;

    for (const chunk of plan.chunks) {
      const ref = await transport.send(plan.recipientId, chunk, channelId);
      if (!ref) {
        for (const partial of sentRefs) {
          await transport.delete(partial);
        }
        sentRefs.length = 0;
        break;
      }
      sentRefs.push(ref);
      channelId = ref.channelId;
    }

    if (sentRefs.length !== plan.chunks.length) {
      continue;
    }

    if (plan.channelId) {
      for (const oldId of plan.previousMessageIds) {
        await transport.delete({ channelId: plan.channelId, messageId: oldId });
      }
    }

    if (transport.notify) {
      await transport.notify(plan.recipientId, plan.summary);
    }

    await deps.api.recordDealAlertDelivery({
      recipientId: plan.recipientId,
      channelId: sentRefs[0].channelId,
      messageIds: sentRefs.map((ref) => ref.messageId),
      lastListingKeys: plan.lastListingKeys,
    });
  }
}

export interface DealAlertNotifierOptions {
  communityId?: string;
  api?: RootBotApi;
  config?: RootCommunityConfig;
  intervalMs?: number;
  scheduler?: JobScheduler;
  rootApi?: RootDealAlertApi;
  createTransport?: (sectionId: string) => DirectMessageSink;
}

export async function startDealAlertNotifier(
  options: DealAlertNotifierOptions = {}
): Promise<void> {
  const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
  const api = options.api ?? new RootBotApi({ communityId });
  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);
  const rootApi = options.rootApi ?? createRootServerDealAlertApi();
  const ensureSection = () => ensureAlertSection(rootApi, config);
  const createTransport =
    options.createTransport ??
    ((sectionId) =>
      createRootDealAlertTransport({ channelGroupId: sectionId, api: rootApi }));

  const intervalMs =
    options.intervalMs ??
    Number.parseInt(process.env.ROOT_DEAL_ALERT_INTERVAL_MS ?? "300000", 10);

  const run = async (): Promise<void> => {
    try {
      await runDealAlertPoll({ api, ensureSection, createTransport });
    } catch (err) {
      await reportDiagnostic({
        stage: "deal-alert-poll-failed",
        communityId,
        message: err,
        level: CommunityAppLogType.Error,
      });
    }
  };

  // Run once immediately; authenticate and deliver without waiting for the
  // first scheduled job.
  await run();

  await scheduleRootBotPolling({
    scheduler: options.scheduler ?? rootServer.jobScheduler,
    resourceId: "ga-deal-alerts",
    tag: "deal-alerts",
    intervalMs,
    run,
    onError: (err) => {
      void reportDiagnostic({
        stage: "deal-alert-scheduler-failed",
        communityId,
        message: err,
        level: CommunityAppLogType.Error,
      });
    },
  });
}

export interface RecipientChannelOptions {
  communityId?: string;
  api?: RootBotApi;
  config?: RootCommunityConfig;
  rootApi?: RootDealAlertApi;
}

/**
 * Runs one deal-alert delivery immediately (used after opt-in so the list is
 * populated without waiting for the next scheduled poll).
 */
export async function provisionRootDealAlerts(
  options: RecipientChannelOptions = {}
): Promise<void> {
  const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
  const api = options.api ?? new RootBotApi({ communityId });
  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);
  const rootApi = options.rootApi ?? createRootServerDealAlertApi();

  await runDealAlertPoll({
    api,
    ensureSection: () => ensureAlertSection(rootApi, config),
    createTransport: (sectionId) =>
      createRootDealAlertTransport({ channelGroupId: sectionId, api: rootApi }),
  });
}

/**
 * Ensures the recipient has a private deal-alert channel and posts a welcome
 * message in it. Channel existence is tracked by the API.
 */
export async function ensureRootRecipientChannel(
  recipientId: string,
  options: RecipientChannelOptions = {}
): Promise<string> {
  const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
  const api = options.api ?? new RootBotApi({ communityId });

  const existing = await api.getDealAlertChannel(recipientId);
  if (existing) {
    return existing.channelId;
  }

  const rootApi = options.rootApi ?? createRootServerDealAlertApi();
  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);
  const sectionId = await ensureAlertSection(rootApi, config);
  const transport = createRootDealAlertTransport({
    channelGroupId: sectionId,
    api: rootApi,
  });
  const ref = await transport.send(recipientId, WELCOME_MESSAGE);

  if (!ref) {
    throw new Error("Could not create the deal-alert channel.");
  }

  await api.recordDealAlertDelivery({
    recipientId,
    channelId: ref.channelId,
    messageIds: [ref.messageId],
    lastListingKeys: [],
  });

  return ref.channelId;
}

/**
 * Removes a recipient's private deal-alert channel and clears its state.
 */
export async function removeRootDealAlertChannel(
  recipientId: string,
  options: RecipientChannelOptions = {}
): Promise<void> {
  const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
  const api = options.api ?? new RootBotApi({ communityId });

  const existing = await api.getDealAlertChannel(recipientId);
  if (!existing) {
    return;
  }

  const rootApi = options.rootApi ?? createRootServerDealAlertApi();

  for (const id of existing.messageIds) {
    await rootApi.deleteMessage({ channelId: existing.channelId, id });
  }

  try {
    await rootApi.deleteChannel(existing.channelId);
  } catch (err) {
    console.warn(
      `[deal-alert-notifier] Could not delete channel ${existing.channelId}:`,
      err instanceof Error ? err.message : err
    );
  }

  await api.recordDealAlertCleanup(recipientId);
}
