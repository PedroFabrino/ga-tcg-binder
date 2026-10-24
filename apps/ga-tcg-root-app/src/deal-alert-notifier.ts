import { rootServer } from "@rootsdk/server-bot";
import { db } from "../../../src/db";
import {
  adaptDirectMessageSink,
  dispatchDealAlerts,
} from "../../../src/services/discord-deal-notifier";
import {
  ROOT_ALERT_DESTINATION,
  readDealAlertDestinations,
} from "../../../src/lib/market-vocabulary";
import {
  deleteDealAlertMessage,
  getDealAlertMessage,
  upsertDealAlertMessage,
} from "../../../src/db/repositories/deal-alert-repository";
import { findIdentitiesWithNotificationsEnabled } from "../../../src/db/repositories/assistant-repository";
import { parseMessageIds } from "../../../src/services/discord-dm-client";
import {
  createCommunityConfig,
  type RootCommunityConfig,
} from "./community-config";
import { ensureAlertSection } from "./root-deal-alert-section";
import {
  createRootDealAlertTransport,
  createRootServerDealAlertApi,
  type RootDealAlertApi,
} from "./root-deal-alert-transport";

export interface RootDealAlertNotifierOptions {
  intervalMs?: number;
  api?: RootDealAlertApi;
  config?: RootCommunityConfig;
  database?: typeof db;
}

/**
 * Starts the Root deal-alert notifier. It runs continuously inside the Root
 * bot (the only process that holds the Root SDK), dispatching to the
 * `root-alert` destination through the shared Deal Alert matcher/dispatcher.
 * The bot-only section is resolved from per-community config and created on
 * first use.
 */
export function startDealAlertNotifier(
  options: RootDealAlertNotifierOptions = {}
): void {
  if (!readDealAlertDestinations().includes(ROOT_ALERT_DESTINATION)) {
    console.warn(
      "[deal-alert-notifier] root-alert is not in DEAL_ALERT_DM_DESTINATION — Root deal alerts disabled"
    );
    return;
  }

  const intervalMs =
    options.intervalMs ??
    Number.parseInt(process.env.ROOT_DEAL_ALERT_INTERVAL_MS ?? "300000", 10);
  const api = options.api ?? createRootServerDealAlertApi();
  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);
  const database = options.database ?? db;

  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;

    try {
      const channelGroupId = await ensureAlertSection(api, config);
      const transport = createRootDealAlertTransport({ channelGroupId, api });
      const keepRecipients = await optedInRecipients(database);
      const result = await dispatchDealAlerts(
        database,
        adaptDirectMessageSink(transport),
        new Date(),
        { destination: ROOT_ALERT_DESTINATION, keepRecipients }
      );
      if (result.sent > 0) {
        console.log(
          `[deal-alert-notifier] Root: updated ${result.sent}/${result.matched} matched recipients`
        );
      }
    } catch (err) {
      console.error(
        "[deal-alert-notifier] Tick error:",
        err instanceof Error ? err.message : err
      );
    } finally {
      running = false;
    }
  };

  console.log(`[deal-alert-notifier] Starting (interval=${intervalMs}ms)`);

  setInterval(tick, intervalMs);
  void tick();
}

async function optedInRecipients(database: typeof db): Promise<Set<string>> {
  const identities = await findIdentitiesWithNotificationsEnabled("root", database);
  return new Set(identities.map((identity) => identity.providerUserId));
}

const WELCOME_MESSAGE =
  "🔔 **Deal alerts are on.** I'll keep this channel updated with cards from your wantlist and deck shortages that are for sale.";

/**
 * Ensures the recipient has a private deal-alert channel and posts a welcome
 * message in it, so `/notify on` can tell the user exactly where alerts will
 * arrive. Reuses an existing channel when one is already tracked.
 */
export async function ensureRootRecipientChannel(
  recipientId: string,
  options: {
    api?: RootDealAlertApi;
    config?: RootCommunityConfig;
    database?: typeof db;
  } = {}
): Promise<string> {
  const api = options.api ?? createRootServerDealAlertApi();
  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);
  const database = options.database ?? db;

  const existing = await getDealAlertMessage(
    ROOT_ALERT_DESTINATION,
    recipientId,
    database
  );
  if (existing) {
    return existing.channelId;
  }

  const channelGroupId = await ensureAlertSection(api, config);
  const transport = createRootDealAlertTransport({ channelGroupId, api });
  const ref = await transport.send(recipientId, WELCOME_MESSAGE);

  if (!ref) {
    throw new Error("Could not create the deal-alert channel.");
  }

  await upsertDealAlertMessage(
    {
      destination: ROOT_ALERT_DESTINATION,
      recipientId,
      channelId: ref.channelId,
      messageId: ref.messageId,
      lastListingKeys: "[]",
      updatedAt: new Date(),
    },
    database
  );

  return ref.channelId;
}

/**
 * Runs one Root deal-alert dispatch immediately (used after opt-in so the
 * newly-enabled recipient gets their channel without waiting for the next
 * scheduled tick). Ensures the section exists first.
 */
export async function provisionRootDealAlerts(
  database: typeof db = db
): Promise<void> {
  if (!readDealAlertDestinations().includes(ROOT_ALERT_DESTINATION)) {
    return;
  }

  const api = createRootServerDealAlertApi();
  const config = createCommunityConfig(rootServer.dataStore.appData);
  const channelGroupId = await ensureAlertSection(api, config);
  const transport = createRootDealAlertTransport({ channelGroupId, api });
  const keepRecipients = await optedInRecipients(database);

  await dispatchDealAlerts(
    database,
    adaptDirectMessageSink(transport),
    new Date(),
    { destination: ROOT_ALERT_DESTINATION, keepRecipients }
  );
}

/**
 * Removes a recipient's private deal-alert channel and rolling-message state
 * (used on opt-out). Best-effort: a missing channel still clears the stored
 * state.
 */
export async function removeRootDealAlertChannel(
  recipientId: string,
  database: typeof db = db
): Promise<void> {
  const row = await getDealAlertMessage(
    ROOT_ALERT_DESTINATION,
    recipientId,
    database
  );
  if (!row) {
    return;
  }

  const api = createRootServerDealAlertApi();

  for (const id of parseMessageIds(row.messageId)) {
    await api.deleteMessage({ channelId: row.channelId, id });
  }

  try {
    await api.deleteChannel(row.channelId);
  } catch (err) {
    console.warn(
      `[deal-alert-notifier] Could not delete channel ${row.channelId}:`,
      err instanceof Error ? err.message : err
    );
  }

  await deleteDealAlertMessage(ROOT_ALERT_DESTINATION, recipientId, database);
}
