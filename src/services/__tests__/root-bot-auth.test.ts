import { describe, expect, it } from "vitest";
import { createTestDb } from "../../db/test-utils";
import {
  DEFAULT_ROOT_BOT_APP_ID,
  authenticateRootBot,
  issueRootBotToken,
} from "../root-bot-auth";
import { revokeRootBotInstall } from "../../db/repositories/root-bot-install-repository";

function request(token: string, communityId: string) {
  return new Request("http://localhost/api/root-bot/anything", {
    headers: {
      authorization: `Bearer ${token}`,
      "x-root-community-id": communityId,
    },
  });
}

describe("root bot per-install auth", () => {
  it("issues a token and authenticates it for the same community", async () => {
    const { db } = await createTestDb();
    const issued = await issueRootBotToken(
      DEFAULT_ROOT_BOT_APP_ID,
      "comm-1",
      db
    );

    expect(issued?.token).toBeTruthy();
    await expect(
      authenticateRootBot(request(issued!.token, "comm-1"), db)
    ).resolves.toEqual({
      appId: DEFAULT_ROOT_BOT_APP_ID,
      communityId: "comm-1",
    });
  });

  it("rejects a token used with a different community", async () => {
    const { db } = await createTestDb();
    const issued = await issueRootBotToken(
      DEFAULT_ROOT_BOT_APP_ID,
      "comm-1",
      db
    );

    await expect(
      authenticateRootBot(request(issued!.token, "comm-2"), db)
    ).resolves.toBeNull();
  });

  it("rejects unknown app ids", async () => {
    const { db } = await createTestDb();
    await expect(
      issueRootBotToken("SOME-OTHER-APP", "comm-1", db)
    ).resolves.toBeNull();
  });

  it("rejects revoked tokens", async () => {
    const { db } = await createTestDb();
    const issued = await issueRootBotToken(
      DEFAULT_ROOT_BOT_APP_ID,
      "comm-1",
      db
    );
    await revokeRootBotInstall(DEFAULT_ROOT_BOT_APP_ID, "comm-1", db);

    await expect(
      authenticateRootBot(request(issued!.token, "comm-1"), db)
    ).resolves.toBeNull();
  });

  it("rotates the token on re-issue and invalidates the old one", async () => {
    const { db } = await createTestDb();
    const first = await issueRootBotToken(DEFAULT_ROOT_BOT_APP_ID, "comm-1", db);
    const second = await issueRootBotToken(DEFAULT_ROOT_BOT_APP_ID, "comm-1", db);

    expect(second!.token).not.toBe(first!.token);
    await expect(
      authenticateRootBot(request(first!.token, "comm-1"), db)
    ).resolves.toBeNull();
    await expect(
      authenticateRootBot(request(second!.token, "comm-1"), db)
    ).resolves.not.toBeNull();
  });
});
