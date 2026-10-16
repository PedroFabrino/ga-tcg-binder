import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as sessionPost } from "./session/route";
import { GET as sessionTokenGet } from "./session/[token]/route";
import { POST as identifyPost } from "./identify/route";
import { POST as processFramePost } from "./process-frame/route";
import { POST as queuePost, PATCH as queuePatch } from "./queue/route";
import { POST as submitPost } from "./submit/route";
import { POST as confirmPost } from "./confirm/route";

describe("Scanner API Feature Flag Enforcement", () => {
  const originalEnv = process.env.NEXT_PUBLIC_FEATURE_SCANNER;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_FEATURE_SCANNER;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_FEATURE_SCANNER = originalEnv;
  });

  it("returns 404 for all scanner API routes when flag is unset (default false)", async () => {
    const fakeReq = new NextRequest("http://localhost:3002/api/scanner/session", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const sessionRes = await sessionPost(fakeReq);
    expect(sessionRes.status).toBe(404);
    const sessionJson = await sessionRes.json();
    expect(sessionJson.error).toBe("Scanner feature is disabled");

    const tokenRes = await sessionTokenGet(fakeReq, { params: { token: "tok_123" } });
    expect(tokenRes.status).toBe(404);

    const identifyRes = await identifyPost(fakeReq);
    expect(identifyRes.status).toBe(404);

    const processRes = await processFramePost(fakeReq);
    expect(processRes.status).toBe(404);

    const queueRes = await queuePost(fakeReq);
    expect(queueRes.status).toBe(404);

    const patchRes = await queuePatch(fakeReq);
    expect(patchRes.status).toBe(404);

    const submitRes = await submitPost(fakeReq);
    expect(submitRes.status).toBe(404);

    const confirmRes = await confirmPost(fakeReq);
    expect(confirmRes.status).toBe(404);
  });
});
