import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { DEFAULT_ROOT_BOT_APP_ID, issueRootBotToken } from "../root-bot-auth";
import { isAssistantAuthorized } from "../assistant-auth";

function request(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/assistant/decks", { headers });
}

describe("isAssistantAuthorized", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the shared assistant token", async () => {
    vi.stubEnv("ASSISTANT_API_SECRET", "shared");
    vi.stubEnv("ASSISTANT_TOKEN", "");

    await expect(
      isAssistantAuthorized(request({ "x-assistant-token": "shared" }))
    ).resolves.toBe(true);
  });

  it("rejects a wrong shared token", async () => {
    vi.stubEnv("ASSISTANT_API_SECRET", "shared");
    vi.stubEnv("ASSISTANT_TOKEN", "");

    await expect(
      isAssistantAuthorized(request({ "x-assistant-token": "nope" }))
    ).resolves.toBe(false);
  });

  it("accepts a valid per-install bearer token", async () => {
    vi.stubEnv("ASSISTANT_API_SECRET", "shared");
    vi.stubEnv("ASSISTANT_TOKEN", "");
    const { db } = await createTestDb();
    const issued = await issueRootBotToken(DEFAULT_ROOT_BOT_APP_ID, "comm-1", db);

    await expect(
      isAssistantAuthorized(
        request({
          authorization: `Bearer ${issued!.token}`,
          "x-root-community-id": "comm-1",
        }),
        db
      )
    ).resolves.toBe(true);
  });

  it("rejects an unknown bearer token", async () => {
    vi.stubEnv("ASSISTANT_API_SECRET", "shared");
    vi.stubEnv("ASSISTANT_TOKEN", "");
    const { db } = await createTestDb();

    await expect(
      isAssistantAuthorized(
        request({
          authorization: "Bearer nope",
          "x-root-community-id": "comm-1",
        }),
        db
      )
    ).resolves.toBe(false);
  });
});
