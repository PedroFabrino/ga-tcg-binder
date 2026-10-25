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
 * Polls exclusively on Root's job scheduler. Root's scheduler has no sub-daily
 * interval, so we keep one pending one-time job per tag and reschedule it after
 * each run. This keeps every poll inside the SDK's event loop (important for
 * the gRPC clients) and survives restarts via the persisted job.
 */
export declare function scheduleRootBotPolling(options: RootBotPollingOptions): Promise<void>;
