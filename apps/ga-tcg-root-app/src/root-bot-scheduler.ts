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
 * Polls exclusively on Root's job scheduler. Root's scheduler has no sub-daily
 * interval, so we keep one pending one-time job per tag and reschedule it after
 * each run. This keeps every poll inside the SDK's event loop (important for
 * the gRPC clients) and survives restarts via the persisted job.
 */
export async function scheduleRootBotPolling(
  options: RootBotPollingOptions
): Promise<void> {
  const now = options.now ?? (() => new Date());
  const intervalMs =
    Number.isFinite(options.intervalMs) && options.intervalMs > 0
      ? options.intervalMs
      : 30_000;

  const execute = async (): Promise<void> => {
    try {
      await options.run();
    } catch (err) {
      console.error(
        `[root-bot-scheduler] Poll failed for ${options.tag}: ${describeError(err)}`
      );
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

  // `job.missed` fires when a one-time job elapsed while the bot was down, so
  // handle it the same way; otherwise polling would stop permanently.
  options.scheduler.on("job", handle);
  options.scheduler.on("job.missed", handle);

  try {
    await scheduleNext();
  } catch (err) {
    options.onError?.(err);
  }
}
