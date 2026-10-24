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
} from "../../../src/db/repositories/deal-alert-repository";
import { parseMessageIds } from "../../../src/services/discord-dm-client";
import type { DirectMessageSink } from "../../../src/services/market-notification-sink";
import {
  createRootDealAlertTransport,
  createRootServerDealAlertApi,
  type RootDealAlertApi,
} from "./root-deal-alert-transport";

/**
 * The bot-only channel section (channel group). `ROOT_DEAL_ALERT_CHANNEL_ID` is
 * the primary name; `ROOT_DEAL_ALERT_SECTION_ID` is accepted as an alias.
 */
export function readRootDealAlertSectionId(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  return (
    env.ROOT_DEAL_ALERT_SECTION_ID ||
    env.ROOT_DEAL_ALERT_CHANNEL_ID ||
    undefined
  );
}

export interface RootDealAlertNotifierOptions {
  intervalMs?: number;
  api?: RootDealAlertApi;
  database?: typeof db;
}

/**
 * Starts the Root deal-alert notifier. It runs continuously inside the Root
 * bot (the only process that holds the Root SDK), dispatching to the
 * `root-alert` destination through the shared Deal Alert matcher/dispatcher.
 * Disabled unless `ROOT_DEAL_ALERT_SECTION_ID` names the bot-only channel
 * section that holds the per-user channels.
 */
export function startDealAlertNotifier(
  options: RootDealAlertNotifierOptions = {}
): void {
  const channelGroupId = readRootDealAlertSectionId();

  if (!channelGroupId) {
    console.warn(
      "[deal-alert-notifier] ROOT_DEAL_ALERT_CHANNEL_ID / ROOT_DEAL_ALERT_SECTION_ID is not set — Root deal alerts disabled"
    );
    return;
  }

  if (!readDealAlertDestinations().includes(ROOT_ALERT_DESTINATION)) {
    console.warn(
      "[deal-alert-notifier] root-alert is not in DEAL_ALERT_DM_DESTINATION — Root deal alerts disabled"
    );
    return;
  }

  const intervalMs =
    options.intervalMs ??
    Number.parseInt(process.env.ROOT_DEAL_ALERT_INTERVAL_MS ?? "300000", 10);
  const transport = createRootDealAlertTransport({
    channelGroupId,
    api: options.api ?? createRootServerDealAlertApi(),
  });
  const database = options.database ?? db;

  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;

    try {
      const result = await dispatchDealAlerts(
        database,
        adaptDirectMessageSink(transport),
        new Date(),
        { destination: ROOT_ALERT_DESTINATION }
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

  console.log(
    `[deal-alert-notifier] Starting (interval=${intervalMs}ms, section=${channelGroupId})`
  );

  setInterval(tick, intervalMs);
  void tick();
}

function rootDealAlertTransportFromEnv(
  api?: RootDealAlertApi
): DirectMessageSink | null {
  const channelGroupId = readRootDealAlertSectionId();
  if (!channelGroupId) {
    return null;
  }
  return createRootDealAlertTransport({
    channelGroupId,
    api: api ?? createRootServerDealAlertApi(),
  });
}

/**
 * Runs one Root deal-alert dispatch immediately (used after opt-in so the
 * newly-enabled recipient gets their channel without waiting for the next
 * scheduled tick). No-op when the section is not configured.
 */
export async function provisionRootDealAlerts(
  database: typeof db = db
): Promise<void> {
  if (!readDealAlertDestinations().includes(ROOT_ALERT_DESTINATION)) {
    return;
  }
  const transport = rootDealAlertTransportFromEnv();
  if (!transport) {
    return;
  }
  await dispatchDealAlerts(database, adaptDirectMessageSink(transport), new Date(), {
    destination: ROOT_ALERT_DESTINATION,
  });
}

/**
 * Removes a recipient's private deal-alert channel and rolling-message state
 * (used on opt-out). Best-effort: a missing channel or an unconfigured section
 * still clears the stored state.
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

  const transport = rootDealAlertTransportFromEnv();
  if (transport) {
    for (const id of parseMessageIds(row.messageId)) {
      await transport.delete({ channelId: row.channelId, messageId: id });
    }
  }

  if (readRootDealAlertSectionId()) {
    await createRootServerDealAlertApi().deleteChannel(row.channelId);
  }

  await deleteDealAlertMessage(ROOT_ALERT_DESTINATION, recipientId, database);
}
