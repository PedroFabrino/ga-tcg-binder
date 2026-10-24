import { type JobScheduler } from "@rootsdk/server-bot";
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
export declare function scheduleRootBotPolling(options: RootBotPollingOptions): Promise<void>;
