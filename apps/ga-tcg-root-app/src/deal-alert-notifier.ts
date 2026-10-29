import {
  rootServer,
  CommunityAppLogType,
  type JobScheduler,
} from "@rootsdk/server-app";
import {
  type SupportedLocale,
  getDictionary,
} from "../../../packages/contracts/src/i18n";
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

export function getWelcomeMessage(locale: string = "en"): string {
  const normalized: SupportedLocale = locale === "pt-BR" ? "pt-BR" : "en";
  return getDictionary(normalized).rootApp.notifications.dealAlertWelcome;
}

export const WELCOME_MESSAGE = getWelcomeMessage("en");

export interface DealAlertPollDeps {
  api: Pick<
    RootBotApi,
    "getDealAlerts" | "recordDealAlertDelivery" | "recordDealAlertCleanup"
  >;
  ensureSection: () => Promise<string | undefined>;
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
  if (!sectionId) {
    return;
  }
  const transport = deps.createTransport(sectionId);

  for (const item of cleanup) {
    for (const id of item.messageIds) {
      try {
        await transport.delete({ channelId: item.channelId, messageId: id });
      } catch (err) {
        console.warn(
          `[deal-alert-notifier] Could not delete cleanup message ${id} in channel ${item.channelId}:`,
          err instanceof Error ? err.message : err
        );
      }
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
          try {
            await transport.delete(partial);
          } catch (err) {
            console.warn(
              `[deal-alert-notifier] Could not roll back partial message ${partial.messageId}:`,
              err instanceof Error ? err.message : err
            );
          }
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

    const deliveredChannelId = sentRefs[0].channelId;

    await deps.api.recordDealAlertDelivery({
      recipientId: plan.recipientId,
      channelId: deliveredChannelId,
      messageIds: sentRefs.map((ref) => ref.messageId),
      lastListingKeys: plan.lastListingKeys,
    });

    if (plan.channelId && plan.channelId === deliveredChannelId) {
      for (const oldId of plan.previousMessageIds) {
        try {
          await transport.delete({ channelId: plan.channelId, messageId: oldId });
        } catch (err) {
          console.warn(
            `[deal-alert-notifier] Could not delete previous message ${oldId} in channel ${plan.channelId}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    if (transport.notify) {
      try {
        await transport.notify(plan.recipientId, plan.summary);
      } catch (err) {
        console.warn(
          `[deal-alert-notifier] Could not send notification summary for ${plan.recipientId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
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
  const ensureSection = () => ensureAlertSection(config);
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
  locale?: string;
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
    ensureSection: () => ensureAlertSection(config),
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
  const rootApi = options.rootApi ?? createRootServerDealAlertApi();

  const existing = await api.getDealAlertChannel(recipientId);
  if (existing) {
    try {
      // Reuse only if the channel still exists; reinstalls delete the channel
      // but leave the API-side state behind, which would otherwise point at a
      // dead channel and make the opt-in look successful without a channel.
      await rootApi.getChannel(existing.channelId);
      return existing.channelId;
    } catch {
      // Channel gone — fall through and create a fresh one.
    }
  }

  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);
  const sectionId = await ensureAlertSection(config);
  if (!sectionId) {
    throw new Error(
      "No market group configured — provision market channels in the Assistant App GUI first."
    );
  }
  const transport = createRootDealAlertTransport({
    channelGroupId: sectionId,
    api: rootApi,
  });

  let locale = options.locale;
  if (!locale) {
    try {
      const collector = await api.getCollector(recipientId);
      if (collector?.locale) {
        locale = collector.locale;
      }
    } catch (err) {
      console.warn(`[deal-alert] Failed to resolve collector locale for ${recipientId}, falling back to "en":`, err);
    }
  }

  const welcomeText = getWelcomeMessage(locale);
  const ref = await transport.send(recipientId, welcomeText);

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
    try {
      await rootApi.deleteMessage({ channelId: existing.channelId, id });
    } catch (err) {
      console.warn(
        `[deal-alert-notifier] Could not delete message ${id} in channel ${existing.channelId}:`,
        err instanceof Error ? err.message : err
      );
    }
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
