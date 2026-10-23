import type { SeatId, TableCredentials, TableRole, TableState } from "@ga/contracts";
import { createTableCredentials } from "./table-credentials";
import { TableRoom } from "./table-room";
import type { ConnectionInfo } from "./table-room-types";
import { tableCodeFromPath } from "./table-routes";
import type { UnifiedSocket } from "./unified-socket";

/** The subset of a hibernatable WebSocket the DO needs; fakes satisfy it too. */
export interface TableWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

/** The subset of `DurableObjectState` used here, so tests need no cast. */
export interface TableStorageSql {
  exec(query: string, ...bindings: unknown[]): { toArray(): unknown[] };
}

export interface TableObjectState {
  storage: { sql: TableStorageSql };
  acceptWebSocket(ws: TableWebSocket): void;
  getWebSockets(): TableWebSocket[];
}

const META_TABLE = "table_meta";

/**
 * One Durable Object per Table. It owns the `TableRoom` and mirrors every state
 * change into the object's embedded SQLite storage, then rehydrates both the
 * room and its hibernated sockets on wake. Sockets are accepted through the
 * Hibernation API, so an idle Table consumes no compute duration.
 */
export class TableDO {
  private readonly ctx: TableObjectState;
  private readonly wsToUnified = new Map<TableWebSocket, UnifiedSocket>();
  private readonly unifiedToWs = new Map<UnifiedSocket, TableWebSocket>();
  private room: TableRoom | null = null;

  constructor(ctx: TableObjectState, _env: unknown) {
    this.ctx = ctx;
    this.rehydrate();
  }

  /** Exposed for tests and local introspection. */
  public getRoom(): TableRoom | null {
    return this.room;
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/init") {
      const code = url.searchParams.get("code")?.toUpperCase();
      if (!code) return this.jsonResponse({ error: "Missing code" }, 400);
      if (this.room) return this.jsonResponse({ error: "Table already exists" }, 409);
      return this.jsonResponse(this.initTable(code), 201);
    }

    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket Upgrade", { status: 426 });
    }

    const code = tableCodeFromPath(url.pathname);
    if (!code || !this.room || this.room.getCredentials().code !== code) {
      return new Response("No such table", { status: 404 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    this.getUnifiedSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  public webSocketMessage(ws: TableWebSocket, message: string | ArrayBuffer): void {
    if (!this.room) return;
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    this.room.handleRawMessage(this.getUnifiedSocket(ws), raw);
  }

  public webSocketClose(
    ws: TableWebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): void {
    this.releaseSocket(ws);
  }

  public webSocketError(ws: TableWebSocket, _error: unknown): void {
    this.releaseSocket(ws);
  }

  private initSchema(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS ${META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
    );
  }

  private readMeta(): Map<string, string> {
    try {
      const rows = this.ctx.storage.sql
        .exec(`SELECT key, value FROM ${META_TABLE}`)
        .toArray() as Array<{ key: string; value: string }>;
      return new Map(rows.map(({ key, value }) => [key, value]));
    } catch {
      // A fresh object has no schema yet; /init creates it.
      return new Map();
    }
  }

  private writeMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES (?, ?)`,
      key,
      value
    );
  }

  private rehydrate(): void {
    const meta = this.readMeta();
    const code = meta.get("code");
    const p1Token = meta.get("p1Token");
    const p2Token = meta.get("p2Token");
    const viewerToken = meta.get("viewerToken");
    if (!code || !p1Token || !p2Token || !viewerToken) return;

    const stateRaw = meta.get("state");
    let initialState: TableState | undefined;
    if (stateRaw) {
      try {
        initialState = JSON.parse(stateRaw) as TableState;
      } catch {
        // Corrupt state: keep the credentials and start the table empty.
        initialState = undefined;
      }
    }

    this.room = this.buildRoom({ code, p1Token, p2Token, viewerToken }, initialState);

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as ConnectionInfo | null;
      if (!attachment) continue;
      this.room.rehydrateConnection(
        this.getUnifiedSocket(ws),
        attachment.role,
        attachment.seatId
      );
    }
  }

  private initTable(code: string): TableCredentials {
    this.initSchema();
    const credentials = createTableCredentials(code);
    this.room = this.buildRoom(credentials);
    this.writeMeta("code", credentials.code);
    this.writeMeta("p1Token", credentials.p1Token);
    this.writeMeta("p2Token", credentials.p2Token);
    this.writeMeta("viewerToken", credentials.viewerToken);
    this.writeMeta("state", JSON.stringify(this.room.getState()));
    return credentials;
  }

  private buildRoom(credentials: TableCredentials, initialState?: TableState): TableRoom {
    return new TableRoom(
      credentials.code,
      credentials.p1Token,
      credentials.p2Token,
      credentials.viewerToken,
      {
        initialState,
        onStateChange: (state) => this.writeMeta("state", JSON.stringify(state)),
        onBindingChange: (socket, role, seatId) => {
          const ws = this.unifiedToWs.get(socket);
          if (ws) ws.serializeAttachment(attachmentFor(role, seatId));
        },
      }
    );
  }

  private releaseSocket(ws: TableWebSocket): void {
    const unified = this.wsToUnified.get(ws);
    if (!unified) return;
    this.room?.handleDisconnect(unified);
    this.wsToUnified.delete(ws);
    this.unifiedToWs.delete(unified);
  }

  private getUnifiedSocket(ws: TableWebSocket): UnifiedSocket {
    const existing = this.wsToUnified.get(ws);
    if (existing) return existing;

    const unified: UnifiedSocket = {
      send: (data) => {
        try {
          ws.send(data);
        } catch {
          // The socket is gone; close/error cleanup removes it.
        }
      },
      close: (code, reason) => {
        try {
          ws.close(code, reason);
        } catch {
          // Already closed.
        }
      },
    };
    this.wsToUnified.set(ws, unified);
    this.unifiedToWs.set(unified, ws);
    return unified;
  }

  private jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * A displaced seat or replaced capture device keeps its connection but loses
 * the binding; clearing its attachment stops a wake from restoring it as the
 * owner. Viewers keep an explicit binding so they are restored too.
 */
function attachmentFor(role: TableRole, seatId: SeatId | null): ConnectionInfo | null {
  if (seatId) return { role, seatId };
  return role === "viewer" ? { role: "viewer", seatId: null } : null;
}
