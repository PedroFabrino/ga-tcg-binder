"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const server_bot_1 = require("@rootsdk/server-bot");
const root_bot_scheduler_1 = require("../root-bot-scheduler");
function fakeScheduler() {
    const handlers = new Map();
    const created = [];
    const deletedTags = [];
    const scheduler = {
        on(event, handler) {
            handlers.set(event, handler);
            return scheduler;
        },
        async create(data) {
            created.push(data);
            return { jobScheduleId: `job-${created.length}`, ...data };
        },
        async deleteByTag(tag) {
            deletedTags.push(tag);
        },
    };
    return {
        scheduler,
        created,
        deletedTags,
        emit: (job) => handlers.get("job")?.(job),
        emitMissed: (job) => handlers.get("job.missed")?.(job),
    };
}
(0, vitest_1.describe)("scheduleRootBotPolling", () => {
    (0, vitest_1.it)("schedules a one-time job and reschedules after each tagged run", async () => {
        const fake = fakeScheduler();
        const run = vitest_1.vi.fn().mockResolvedValue(undefined);
        const now = new Date("2026-01-01T00:00:00Z");
        await (0, root_bot_scheduler_1.scheduleRootBotPolling)({
            scheduler: fake.scheduler,
            resourceId: "root-poll",
            tag: "poll",
            intervalMs: 300_000,
            run,
            now: () => now,
        });
        (0, vitest_1.expect)(fake.created).toHaveLength(1);
        (0, vitest_1.expect)(fake.created[0]).toMatchObject({
            resourceId: "root-poll",
            tag: "poll",
            jobInterval: server_bot_1.JobInterval.OneTime,
        });
        (0, vitest_1.expect)(fake.created[0].start.getTime()).toBe(now.getTime() + 300_000);
        fake.emit({ tag: "other" });
        await Promise.resolve();
        (0, vitest_1.expect)(run).not.toHaveBeenCalled();
        fake.emit({ tag: "poll" });
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(run).toHaveBeenCalledTimes(1));
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fake.created).toHaveLength(2));
        fake.emitMissed({ tag: "poll" });
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(run).toHaveBeenCalledTimes(2));
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fake.created).toHaveLength(3));
    });
});
