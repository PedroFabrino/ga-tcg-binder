import { describe, expect, it, vi } from "vitest";
import { JobInterval, type JobScheduler } from "@rootsdk/server-bot";
import { scheduleRootBotPolling } from "../root-bot-scheduler";

function fakeScheduler() {
  const handlers = new Map<string, (job: { tag?: string }) => void>();
  const created: Array<{
    resourceId: string;
    tag: string | null | undefined;
    start: Date;
    jobInterval: JobInterval;
  }> = [];
  const deletedTags: string[] = [];

  const scheduler = {
    on(event: string, handler: (job: { tag?: string }) => void) {
      handlers.set(event, handler);
      return scheduler;
    },
    async create(data: {
      resourceId: string;
      tag: string | null | undefined;
      start: Date;
      jobInterval: JobInterval;
    }) {
      created.push(data);
      return { jobScheduleId: `job-${created.length}`, ...data };
    },
    async deleteByTag(tag: string) {
      deletedTags.push(tag);
    },
  } as unknown as JobScheduler;

  return {
    scheduler,
    created,
    deletedTags,
    emit: (job: { tag?: string }) => handlers.get("job")?.(job),
    emitMissed: (job: { tag?: string }) => handlers.get("job.missed")?.(job),
  };
}

describe("scheduleRootBotPolling", () => {
  it("schedules a one-time job and reschedules after each tagged run", async () => {
    const fake = fakeScheduler();
    const run = vi.fn().mockResolvedValue(undefined);
    const now = new Date("2026-01-01T00:00:00Z");

    await scheduleRootBotPolling({
      scheduler: fake.scheduler,
      resourceId: "root-poll",
      tag: "poll",
      intervalMs: 300_000,
      run,
      now: () => now,
    });

    expect(fake.created).toHaveLength(1);
    expect(fake.created[0]).toMatchObject({
      resourceId: "root-poll",
      tag: "poll",
      jobInterval: JobInterval.OneTime,
    });
    expect(fake.created[0].start.getTime()).toBe(now.getTime() + 300_000);

    fake.emit({ tag: "other" });
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();

    fake.emit({ tag: "poll" });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(fake.created).toHaveLength(2));

    fake.emitMissed({ tag: "poll" });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(fake.created).toHaveLength(3));
  });
});
