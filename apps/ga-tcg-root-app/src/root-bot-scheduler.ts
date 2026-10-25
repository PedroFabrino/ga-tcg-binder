import {
  JobInterval,
  type JobData,
  type JobScheduler,
} from "@rootsdk/server-bot";
import { describeError } from "./describe-error";

export interface RootBotPollingOptions {
  scheduler: JobScheduler;
  resourceId: string;
  tag: string;
  intervalMs: number;
  run: () => Promise<void>;
  now?: () => Date;
  onError?: (err: unknown) => void;
}

/**
 * Polls on Root's job scheduler (primary) with a local watchdog as a safety
 * net. Root's scheduler has no sub-daily interval, so we keep one pending
 * one-time job per tag and reschedule it after each run. If the job table or
 * event delivery is unavailable, the watchdog still polls every interval.
 */
export async function scheduleRootBotPolling(
  options: RootBotPollingOptions
): Promise<void> {
  const now = options.now ?? (() => new Date());
  const intervalMs =
    Number.isFinite(options.intervalMs) && options.intervalMs > 0
      ? options.intervalMs
      : 30_000;

  let inFlight = false;
  let lastStartedAt = Date.now();

  const execute = async (): Promise<void> => {
    if (inFlight) return;
    inFlight = true;
    lastStartedAt = Date.now();
    try {
      await options.run();
    } catch (err) {
      console.error(
        `[root-bot-scheduler] Poll failed for ${options.tag}: ${describeError(err)}`
      );
    } finally {
      inFlight = false;
    }
  };

  const scheduleNext = async (): Promise<void> => {
    await options.scheduler.deleteByTag(options.tag);
    await options.scheduler.create({
      resourceId: options.resourceId,
      tag: options.tag,
      start: new Date(now().getTime() + intervalMs),
      jobInterval: JobInterval.OneTime,
    });
  };

  const handle = (job: JobData): void => {
    if (job.tag !== options.tag) {
      return;
    }
    void (async () => {
      await execute();
      try {
        await scheduleNext();
      } catch (err) {
        options.onError?.(err);
      }
    })();
  };

  options.scheduler.on("job", handle);
  options.scheduler.on("job.missed", handle);

  // Safety net: runs only when the scheduler has been idle for a full interval,
  // so it never duplicates a scheduler-driven poll.
  const watchdog = setInterval(
    () => {
      if (inFlight) return;
      if (Date.now() - lastStartedAt < intervalMs) return;
      void execute();
    },
    Math.max(5_000, Math.floor(intervalMs / 2))
  );
  if (typeof watchdog.unref === "function") {
    watchdog.unref();
  }

  try {
    await scheduleNext();
  } catch (err) {
    // The watchdog keeps the bot polling even when the scheduler is unusable.
    options.onError?.(err);
  }
}
