import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET as getDecks } from "../decks/route";
import { GET as getShortages } from "../shortages/route";
import { GET as getCollection } from "../collection/route";
import { GET as getWantlist } from "../wantlist/route";
import * as assistantAuth from "@/services/assistant-auth";
import * as collectorAssistant from "@/services/collector-assistant";

describe("Assistant API Routes (/api/assistant/*)", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("enforces authentication when ASSISTANT_API_SECRET is configured", async () => {
    process.env.ASSISTANT_API_SECRET = "super-secret-token";

    const req = new Request("http://localhost:3000/api/assistant/decks?provider=discord&providerUserId=123", {
      headers: { "x-assistant-token": "wrong-token" },
    });

    const res = await getDecks(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHORIZED");
  });

  it("returns 400 when provider parameter is invalid", async () => {
    const req = new Request("http://localhost:3000/api/assistant/decks?provider=slack&providerUserId=123");
    const res = await getDecks(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_PROVIDER");
  });

  it("returns 404 when chat identity is not linked", async () => {
    vi.spyOn(assistantAuth, "resolveAssistantCaller").mockResolvedValue({
      error: {
        status: 404,
        code: "IDENTITY_NOT_LINKED",
        message: "No account linked",
      },
    });

    const req = new Request("http://localhost:3000/api/assistant/decks?provider=discord&providerUserId=unlinked_user");
    const res = await getDecks(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("IDENTITY_NOT_LINKED");
  });

  it("GET /api/assistant/decks returns collector decks list", async () => {
    vi.spyOn(assistantAuth, "resolveAssistantCaller").mockResolvedValue({
      context: {
        collectorId: "user-1",
        collectorName: "Arthur",
        provider: "discord",
        providerUserId: "discord-user-1",
      },
    });

    vi.spyOn(collectorAssistant, "getCollectorDecks").mockResolvedValue([
      {
        id: "deck-1",
        name: "Arthur Fire",
        format: "standard",
        champion: "Rai",
        totalCards: 60,
        uniqueCards: 20,
        completionPercentage: 90,
        hardShortageCount: 2,
        sharedShortageCount: 1,
      },
    ]);

    const req = new Request("http://localhost:3000/api/assistant/decks?provider=discord&providerUserId=discord-user-1");
    const res = await getDecks(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.collectorId).toBe("user-1");
    expect(data.decks).toHaveLength(1);
    expect(data.decks[0].name).toBe("Arthur Fire");
  });

  it("GET /api/assistant/shortages validates deck parameter and returns shortages", async () => {
    vi.spyOn(assistantAuth, "resolveAssistantCaller").mockResolvedValue({
      context: {
        collectorId: "user-1",
        collectorName: "Arthur",
        provider: "discord",
        providerUserId: "discord-user-1",
      },
    });

    // Missing deck param
    const reqMissing = new Request("http://localhost:3000/api/assistant/shortages?provider=discord&providerUserId=discord-user-1");
    const resMissing = await getShortages(reqMissing);
    expect(resMissing.status).toBe(400);

    // Valid deck param
    vi.spyOn(collectorAssistant, "getDeckShortages").mockResolvedValue({
      collectorId: "user-1",
      deckId: "deck-1",
      deckName: "Arthur Fire",
      format: "standard",
      completionPercentage: 85,
      hardShortages: [],
      sharedShortages: [],
      totalHardShortages: 0,
      totalSharedShortages: 0,
    });

    const reqValid = new Request("http://localhost:3000/api/assistant/shortages?provider=discord&providerUserId=discord-user-1&deck=deck-1");
    const resValid = await getShortages(reqValid);
    expect(resValid.status).toBe(200);
    const data = await resValid.json();
    expect(data.deckName).toBe("Arthur Fire");
  });

  it("GET /api/assistant/collection returns searched collection cards", async () => {
    vi.spyOn(assistantAuth, "resolveAssistantCaller").mockResolvedValue({
      context: {
        collectorId: "user-1",
        collectorName: "Arthur",
        provider: "discord",
        providerUserId: "discord-user-1",
      },
    });

    vi.spyOn(collectorAssistant, "searchCollectorCollection").mockResolvedValue({
      collectorId: "user-1",
      query: "fracturize",
      cards: [],
    });

    const req = new Request("http://localhost:3000/api/assistant/collection?provider=discord&providerUserId=discord-user-1&query=fracturize");
    const res = await getCollection(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.query).toBe("fracturize");
  });

  it("GET /api/assistant/wantlist returns partitioned wantlist", async () => {
    vi.spyOn(assistantAuth, "resolveAssistantCaller").mockResolvedValue({
      context: {
        collectorId: "user-1",
        collectorName: "Arthur",
        provider: "discord",
        providerUserId: "discord-user-1",
      },
    });

    vi.spyOn(collectorAssistant, "getDeckPartitionedWantlist").mockResolvedValue({
      collectorId: "user-1",
      decks: [],
      totalDecks: 0,
      grandTotalHard: 0,
      grandTotalShared: 0,
    });

    const req = new Request("http://localhost:3000/api/assistant/wantlist?provider=discord&providerUserId=discord-user-1");
    const res = await getWantlist(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.collectorName).toBe("Arthur");
  });
});
