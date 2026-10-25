import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({ recordRootBotDiagnostic: vi.fn() }));

vi.mock("@/db/repositories/root-bot-diagnostic-repository", () => repoMocks);

import { POST } from "../route";

const APP_ID = "ADH-6fbvigmppj1_qgZSmw";

function request(body: unknown): Request {
  return new Request("http://localhost/api/root-bot/diagnostic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/root-bot/diagnostic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a diagnostic for the allowlisted app", async () => {
    const response = await POST(
      request({
        appId: APP_ID,
        communityId: "comm-1",
        stage: "boot",
        message: "process started",
      })
    );

    expect(response.status).toBe(200);
    expect(repoMocks.recordRootBotDiagnostic).toHaveBeenCalledWith({
      communityId: "comm-1",
      stage: "boot",
      message: "process started",
    });
  });

  it("rejects unknown app ids", async () => {
    const response = await POST(
      request({
        appId: "other",
        communityId: "comm-1",
        stage: "boot",
      })
    );

    expect(response.status).toBe(403);
    expect(repoMocks.recordRootBotDiagnostic).not.toHaveBeenCalled();
  });

  it("rejects missing fields", async () => {
    const response = await POST(request({ appId: APP_ID }));

    expect(response.status).toBe(403);
    expect(repoMocks.recordRootBotDiagnostic).not.toHaveBeenCalled();
  });
});
