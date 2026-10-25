import { type JobScheduler } from "@rootsdk/server-bot";
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
export declare function scheduleRootBotPolling(options: RootBotPollingOptions): Promise<void>;
