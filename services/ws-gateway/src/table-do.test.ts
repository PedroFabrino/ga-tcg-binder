import { describe, expect, it, vi } from "vitest";
import type { TableCredentials, TableState } from "@ga/contracts";
import worker, { type Env } from "./cf-worker";
import { MockSocket, hello } from "./mock-socket";
import {
  TableDO,
  type TableObjectState,
  type TableStorageSql,
  type TableWebSocket,
} from "./table-do";

class MockSql implements TableStorageSql {
  public ddlCalls = 0;
  private readonly rows = new Map<string, string>();

  public exec(query: string, ...bindings: unknown[]): { toArray(): unknown[] } {
    const normalized = query.trim().toUpperCase();

    if (normalized.startsWith("CREATE TABLE")) {
      this.ddlCalls += 1;
      return { toArray: () => [] };
    }

    if (normalized.startsWith("INSERT OR REPLACE")) {
      const [key, value] = bindings;
      if (typeof key === "string" && typeof value === "string") this.rows.set(key, value);
      return { toArray: () => [] };
    }

    if (normalized.startsWith("SELECT KEY, VALUE")) {
      return {
        toArray: () => Array.from(this.rows, ([key, value]) => ({ key, value })),
      };
    }

    return { toArray: () => [] };
  }

  public snapshot(): Map<string, string> {
    return new Map(this.rows);
  }
}

class MockCtx implements TableObjectState {
  public readonly sql = new MockSql();
  public readonly storage = { sql: this.sql };
  private readonly sockets: TableWebSocket[] = [];

  public acceptWebSocket(ws: TableWebSocket): void {
    this.sockets.push(ws);
  }

  public getWebSockets(): TableWebSocket[] {
    return this.sockets;
  }
}

class MockWebSocket extends MockSocket implements TableWebSocket {
  public attachment: unknown = null;
  public closed = false;

  public serializeAttachment(value: unknown): void {
    this.attachment = value;
  }

  public deserializeAttachment(): unknown {
    return this.attachment;
  }

  public close(): void {
    this.closed = true;
  }
}

async function createTable(door: TableDO, code: string): Promise<TableCredentials> {
  const response = await door.fetch(
    new Request(`https://do/init?code=${code}`, { method: "POST" })
  );
  expect(response.status).toBe(201);
  return (await response.json()) as TableCredentials;
}

function readState(ctx: MockCtx): TableState {
  return JSON.parse(ctx.sql.snapshot().get("state") ?? "{}") as TableState;
}

describe("TableDO", () => {
  it("creates credentials once and persists them in SQLite", async () => {
    const ctx = new MockCtx();
    const door = new TableDO(ctx, {});
    const credentials = await createTable(door, "ROOM01");

    expect(credentials.code).toBe("ROOM01");
    expect(credentials.p1Token).toMatch(/^[0-9a-f]{32}$/);
    expect(credentials.p2Token).toMatch(/^[0-9a-f]{32}$/);
    expect(credentials.viewerToken).toMatch(/^[0-9a-f]{32}$/);

    const meta = ctx.sql.snapshot();
    expect(meta.get("code")).toBe("ROOM01");
    expect(meta.get("p1Token")).toBe(credentials.p1Token);
    expect(meta.get("p2Token")).toBe(credentials.p2Token);
    expect(meta.get("viewerToken")).toBe(credentials.viewerToken);

    const again = await door.fetch(
      new Request("https://do/init?code=ROOM01", { method: "POST" })
    );
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "Table already exists" });
  });

  it("mirrors state between two seats and persists every change", async () => {
    const ctx = new MockCtx();
    const door = new TableDO(ctx, {});
    const credentials = await createTable(door, "ROOM02");
    const p1 = new MockWebSocket();
    const p2 = new MockWebSocket();
    ctx.acceptWebSocket(p1);
    ctx.acceptWebSocket(p2);

    door.webSocketMessage(p1, hello("ROOM02", credentials.p1Token, "seat", "Alice"));
    door.webSocketMessage(p2, hello("ROOM02", credentials.p2Token, "seat", "Bob"));

    expect(p1.attachment).toEqual({ role: "seat", seatId: "p1" });
    expect(p2.attachment).toEqual({ role: "seat", seatId: "p2" });

    door.webSocketMessage(p1, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 7 } }));

    const state = p2.lastState();
    expect(state?.seats.p1?.damage).toBe(7);
    expect(state?.seats.p2?.displayName).toBe("Bob");

    const persisted = readState(ctx);
    expect(persisted.seats.p1?.damage).toBe(7);
  });

  it("broadcasts a ripple but never persists it", async () => {
    const ctx = new MockCtx();
    const door = new TableDO(ctx, {});
    const credentials = await createTable(door, "ROOMRIP");
    const p1 = new MockWebSocket();
    const p2 = new MockWebSocket();
    door.webSocketMessage(p1, hello("ROOMRIP", credentials.p1Token, "seat", "Alice"));
    door.webSocketMessage(p2, hello("ROOMRIP", credentials.p2Token, "seat", "Bob"));

    door.webSocketMessage(p1, JSON.stringify({ type: "RIPPLE", x: 0.4, y: 0.6 }));

    expect(p2.lastState()?.ripples[0]).toMatchObject({ seat: "p1", x: 0.4, y: 0.6, n: 1 });
    expect(readState(ctx).ripples).toEqual([]);
  });

  it("clears a replaced capture device's binding and persists viewers", async () => {
    const ctx = new MockCtx();
    const door = new TableDO(ctx, {});
    const credentials = await createTable(door, "ROOM06");
    const firstCam = new MockWebSocket();
    const secondCam = new MockWebSocket();
    const viewer = new MockWebSocket();
    ctx.acceptWebSocket(firstCam);
    ctx.acceptWebSocket(secondCam);
    ctx.acceptWebSocket(viewer);

    door.webSocketMessage(
      firstCam,
      hello("ROOM06", credentials.p1Token, "capture", "cam one")
    );
    expect(firstCam.attachment).toEqual({ role: "capture", seatId: "p1" });

    door.webSocketMessage(
      secondCam,
      hello("ROOM06", credentials.p1Token, "capture", "cam two")
    );
    expect(secondCam.attachment).toEqual({ role: "capture", seatId: "p1" });
    expect(firstCam.attachment).toBeNull();

    door.webSocketMessage(
      viewer,
      hello("ROOM06", credentials.viewerToken, "viewer", "viewer")
    );
    expect(viewer.attachment).toEqual({ role: "viewer", seatId: null });
  });

  it("rehydrates the room and socket bindings after hibernation", async () => {
    const ctx = new MockCtx();
    const first = new TableDO(ctx, {});
    const credentials = await createTable(first, "ROOM03");
    const p1 = new MockWebSocket();
    ctx.acceptWebSocket(p1);
    first.webSocketMessage(p1, hello("ROOM03", credentials.p1Token, "seat", "Alice"));
    first.webSocketMessage(p1, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 12 } }));

    // A fresh instance over the same storage and hibernated sockets is a wake.
    const woken = new TableDO(ctx, {});
    const room = woken.getRoom();
    expect(room?.getCredentials().code).toBe("ROOM03");
    expect(room?.getCredentials().p1Token).toBe(credentials.p1Token);
    expect(room?.getState().seats.p1?.damage).toBe(12);

    // The hibernated socket acts without sending HELLO again, and rehydrating
    // must not replay the join into the log.
    woken.webSocketMessage(p1, JSON.stringify({ type: "TURN_START" }));
    expect(room?.getState().active).toBe("p1");
    expect(room?.getState().log.filter((entry) => entry.kind === "join")).toHaveLength(1);

    // A fresh connection with the same token takes the seat; the old socket's
    // attachment is cleared so a later wake cannot restore it as the owner.
    const reconnect = new MockWebSocket();
    woken.webSocketMessage(
      reconnect,
      hello("ROOM03", credentials.p1Token, "seat", "Alice reloaded")
    );
    expect(reconnect.lastState()?.seats.p1?.displayName).toBe("Alice reloaded");
    expect(p1.errors()).toContain("DISPLACED");
    expect(p1.attachment).toBeNull();
  });

  it("persists a disconnect and keeps the table addressable", async () => {
    const ctx = new MockCtx();
    const door = new TableDO(ctx, {});
    const credentials = await createTable(door, "ROOM04");
    const p1 = new MockWebSocket();
    ctx.acceptWebSocket(p1);

    door.webSocketMessage(p1, hello("ROOM04", credentials.p1Token, "seat", "Alice"));
    door.webSocketClose(p1, 1000, "bye", true);

    expect(readState(ctx).log.some((entry) => entry.kind === "disconnect")).toBe(true);
    expect(readState(ctx).code).toBe("ROOM04");
  });

  it("rejects an upgrade for an unknown code without creating a table", async () => {
    const ctx = new MockCtx();
    const door = new TableDO(ctx, {});

    const response = await door.fetch(
      new Request("https://do/t/NOPE00", { headers: { Upgrade: "websocket" } })
    );

    expect(response.status).toBe(404);
    expect(door.getRoom()).toBeNull();
    expect(ctx.sql.ddlCalls).toBe(0);
  });
});

describe("Cloudflare Worker routing", () => {
  function envWith(
    stub: { fetch: (request: Request) => Promise<Response> },
    onName: (name: string) => void
  ): Env {
    return {
      TABLE_DO: {
        idFromName: (name: string) => {
          onName(name);
          return name;
        },
        get: () => stub,
      },
    } as unknown as Env; // The worker only uses idFromName/get; the namespace is wider.
  }

  it("routes POST /api/table to a new DO and returns its credentials", async () => {
    const stub = {
      fetch: vi.fn(async (request: Request) => {
        const code = new URL(request.url).searchParams.get("code");
        return new Response(
          JSON.stringify({ code, p1Token: "p1", p2Token: "p2", viewerToken: "viewer" }),
          { status: 201 }
        );
      }),
    };
    let createdName = "";
    const env = envWith(stub, (name) => {
      createdName = name;
    });

    const response = await worker.fetch(
      new Request("https://gateway.test/api/table", { method: "POST" }),
      env
    );

    expect(response.status).toBe(201);
    const credentials = (await response.json()) as TableCredentials;
    expect(createdName).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(credentials.code).toBe(createdName);
    expect(stub.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries creation when the DO reports a code collision", async () => {
    let calls = 0;
    const names: string[] = [];
    const stub = {
      fetch: vi.fn(async (request: Request) => {
        calls += 1;
        if (calls === 1) return new Response("exists", { status: 409 });
        const code = new URL(request.url).searchParams.get("code");
        return new Response(
          JSON.stringify({ code, p1Token: "p1", p2Token: "p2", viewerToken: "viewer" }),
          { status: 201 }
        );
      }),
    };
    const env = envWith(stub, (name) => {
      names.push(name);
    });

    const response = await worker.fetch(
      new Request("https://gateway.test/api/table", { method: "POST" }),
      env
    );

    expect(response.status).toBe(201);
    expect(calls).toBe(2);
    const credentials = (await response.json()) as TableCredentials;
    expect(credentials.code).toBe(names.at(-1));
  });

  it("routes a /t/:code WebSocket upgrade to the DO named code", async () => {
    const stub = {
      fetch: vi.fn(async (request: Request) => {
        expect(new URL(request.url).pathname).toBe("/t/xyz789");
        return new Response("upgrade accepted", { status: 200 });
      }),
    };
    let requestedName = "";
    const env = envWith(stub, (name) => {
      requestedName = name;
    });

    const response = await worker.fetch(
      new Request("https://gateway.test/t/xyz789", {
        headers: { Upgrade: "websocket" },
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(requestedName).toBe("XYZ789");
    expect(stub.fetch).toHaveBeenCalledTimes(1);
  });
});
