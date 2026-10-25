"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleRootBotPolling = scheduleRootBotPolling;
const server_bot_1 = require("@rootsdk/server-bot");
const describe_error_1 = require("./describe-error");
/**
 * Polls on Root's job scheduler (primary) with a local watchdog as a safety
 * net. Root's scheduler has no sub-daily interval, so we keep one pending
 * one-time job per tag and reschedule it after each run. If the job table or
 * event delivery is unavailable, the watchdog still polls every interval.
 */
async function scheduleRootBotPolling(options) {
    const now = options.now ?? (() => new Date());
    const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs > 0
        ? options.intervalMs
        : 30_000;
    let inFlight = false;
    let lastStartedAt = Date.now();
    const execute = async () => {
        if (inFlight)
            return;
        inFlight = true;
        lastStartedAt = Date.now();
        try {
            await options.run();
        }
        catch (err) {
            console.error(`[root-bot-scheduler] Poll failed for ${options.tag}: ${(0, describe_error_1.describeError)(err)}`);
        }
        finally {
            inFlight = false;
        }
    };
    const scheduleNext = async () => {
        await options.scheduler.deleteByTag(options.tag);
        await options.scheduler.create({
            resourceId: options.resourceId,
            tag: options.tag,
            start: new Date(now().getTime() + intervalMs),
            jobInterval: server_bot_1.JobInterval.OneTime,
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
    options.scheduler.on("job", handle);
    options.scheduler.on("job.missed", handle);
    // Safety net: runs only when the scheduler has been idle for a full interval,
    // so it never duplicates a scheduler-driven poll.
    const watchdog = setInterval(() => {
        if (inFlight)
            return;
        if (Date.now() - lastStartedAt < intervalMs)
            return;
        void execute();
    }, Math.max(5_000, Math.floor(intervalMs / 2)));
    if (typeof watchdog.unref === "function") {
        watchdog.unref();
    }
    try {
        await scheduleNext();
    }
    catch (err) {
        // The watchdog keeps the bot polling even when the scheduler is unusable.
        options.onError?.(err);
    }
}
