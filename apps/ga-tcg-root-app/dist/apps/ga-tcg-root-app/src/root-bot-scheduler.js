"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleRootBotPolling = scheduleRootBotPolling;
const server_app_1 = require("@rootsdk/server-app");
const describe_error_1 = require("./describe-error");
/**
 * Polls exclusively on Root's job scheduler. Root's scheduler has no sub-daily
 * interval, so we keep one pending one-time job per tag and reschedule it after
 * each run. This keeps every poll inside the SDK's event loop (important for
 * the gRPC clients) and survives restarts via the persisted job.
 */
async function scheduleRootBotPolling(options) {
    const now = options.now ?? (() => new Date());
    const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs > 0
        ? options.intervalMs
        : 30_000;
    const execute = async () => {
        try {
            await options.run();
        }
        catch (err) {
            console.error(`[root-bot-scheduler] Poll failed for ${options.tag}: ${(0, describe_error_1.describeError)(err)}`);
        }
    };
    const scheduleNext = async () => {
        await options.scheduler.deleteByTag(options.tag);
        await options.scheduler.create({
            resourceId: options.resourceId,
            tag: options.tag,
            start: new Date(now().getTime() + intervalMs),
            jobInterval: server_app_1.JobInterval.OneTime,
        });
    };
    const handle = (job) => {
        if (job.tag !== options.tag) {
            return;
        }
        void (async () => {
            await execute();
            try {
                await scheduleNext();
            }
            catch (err) {
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
    }
    catch (err) {
        options.onError?.(err);
    }
}
