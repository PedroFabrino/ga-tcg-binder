import {
  JobInterval,
  type JobData,
  type JobScheduler,
} from "@rootsdk/server-bot";

export interface RootBotPollingOptions {
  scheduler: JobScheduler;
  resourceId: string;
  tag: string;
  intervalMs: number;
  run: () => Promise<void>;
  now?: () => Date;
}

/**
 * Polls on Root's job scheduler. Root's scheduler has no sub-daily interval, so
 * we keep exactly one pending one-time job per tag and reschedule it after each
 * run. This survives restarts (the pending job is persisted), unlike a local
 * `setInterval` in an event-driven cloud instance.
 */
export async function scheduleRootBotPolling(
  options: RootBotPollingOptions
): Promise<void> {
  const now = options.now ?? (() => new Date());

  const scheduleNext = async (): Promise<void> => {
    await options.scheduler.deleteByTag(options.tag);
    await options.scheduler.create({
      resourceId: options.resourceId,
      tag: options.tag,
      start: new Date(now().getTime() + options.intervalMs),
      jobInterval: JobInterval.OneTime,
    });
  };

  const handle = (job: JobData): void => {
    if (job.tag !== options.tag) {
      return;
    }
    void (async () => {
      try {
        await options.run();
      } catch (err) {
        console.error(
          `[root-bot-scheduler] Poll failed for ${options.tag}:`,
          err instanceof Error ? err.message : err
        );
      } finally {
        try {
          await scheduleNext();
        } catch (err) {
          console.error(
            `[root-bot-scheduler] Could not reschedule ${options.tag}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })();
  };

  // `job.missed` fires when a one-time job elapsed while the bot was down, so
  // handle it the same way; otherwise polling would stop permanently.
  options.scheduler.on("job", handle);
  options.scheduler.on("job.missed", handle);

  await scheduleNext();
}
