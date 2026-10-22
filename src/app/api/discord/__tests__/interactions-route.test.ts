import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "../interactions/route";
import * as discordService from "@/services/discord-interaction";
import crypto from "crypto";

describe("Discord Interactions Route (POST /api/discord/interactions)", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.DISCORD_PUBLIC_KEY;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("handles Discord Ping interaction (type: 1) returning Pong (type: 1)", async () => {
    const req = new Request("http://localhost:3000/api/discord/interactions", {
      method: "POST",
      body: JSON.stringify({ type: 1, id: "ping-1", token: "tok-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ type: 1 });
  });

  it("validates Ed25519 signature when DISCORD_PUBLIC_KEY is configured", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const rawPubHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
    process.env.DISCORD_PUBLIC_KEY = rawPubHex;

    const timestamp = "1729540000";
    const body = JSON.stringify({ type: 1, id: "ping-2", token: "tok-2" });
    const signature = crypto
      .sign(null, Buffer.from(timestamp + body), privateKey)
      .toString("hex");

    // Valid signature passes
    const validReq = new Request("http://localhost:3000/api/discord/interactions", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "x-signature-ed25519": signature,
        "x-signature-timestamp": timestamp,
      },
    });
    const validRes = await POST(validReq);
    expect(validRes.status).toBe(200);

    // Invalid signature rejected with 401
    const invalidReq = new Request("http://localhost:3000/api/discord/interactions", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "x-signature-ed25519": "0000000000000000000000000000000000000000000000000000000000000000",
        "x-signature-timestamp": timestamp,
      },
    });
    const invalidRes = await POST(invalidReq);
    expect(invalidRes.status).toBe(401);
  });

  it("dispatches application commands and enforces ephemeral flags (flags: 64)", async () => {
    vi.spyOn(discordService, "handleDiscordInteraction").mockResolvedValue({
      type: 4,
      data: {
        flags: 64,
        embeds: [{ title: "Arthur's Decks", color: 0x3498db }],
      },
    });

    const req = new Request("http://localhost:3000/api/discord/interactions", {
      method: "POST",
      body: JSON.stringify({
        type: 2,
        id: "cmd-1",
        token: "tok-cmd",
        data: { name: "decks" },
        user: { id: "discord-user-1", username: "Arthur" },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.type).toBe(4);
    expect(data.data.flags).toBe(64);
    expect(data.data.embeds[0].title).toBe("Arthur's Decks");
  });
});
