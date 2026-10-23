import { isTableClientMessage, type TableCredentials } from "@ga/contracts";
import type { UnifiedSocket } from "./unified-socket";
import { sendTableError } from "./table-messages";
import { createTableCredentials, generateTableCode } from "./table-credentials";
import { TableRoom } from "./table-room";

/**
 * The dev gateway's in-memory table registry, and the router that binds each
 * socket to the TableRoom for its code.
 *
 * A socket is not attached to a table on connect, because only the HELLO knows
 * which table it belongs to. After binding, every message is forwarded verbatim:
 * all table rules stay inside TableRoom. A socket stays bound to one table for
 * its lifetime (switching tables means reconnecting); a failed bind leaves the
 * socket open so the client can retry.
 *
 * In-memory only, so a restart drops every table. That is fine for development;
 * production hosts one TableRoom per Durable Object instead.
 */
export class TableRoomManager {
  private readonly tables = new Map<string, TableRoom>();
  private readonly socketTables = new Map<UnifiedSocket, TableRoom>();

  public createTable(): TableCredentials {
    let code = generateTableCode();
    while (this.tables.has(code)) {
      code = generateTableCode();
    }

    const credentials = createTableCredentials(code);
    this.tables.set(
      code,
      new TableRoom(code, credentials.p1Token, credentials.p2Token, credentials.viewerToken)
    );
    return credentials;
  }

  public getTableCount(): number {
    return this.tables.size;
  }

  public handleConnection(_socket: UnifiedSocket): void {
    // Bound on the first TABLE_HELLO, not on connect.
  }

  public handleRawMessage(socket: UnifiedSocket, rawData: string): void {
    const table = this.socketTables.get(socket);
    if (table) {
      table.handleRawMessage(socket, rawData);
      return;
    }
    this.bind(socket, rawData);
  }

  public handleDisconnect(socket: UnifiedSocket): void {
    const table = this.socketTables.get(socket);
    if (!table) return;
    this.socketTables.delete(socket);
    table.handleDisconnect(socket);
  }

  private bind(socket: UnifiedSocket, rawData: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      sendTableError(socket, "BAD_REQUEST", "First message must be valid JSON");
      return;
    }

    if (!isTableClientMessage(parsed) || parsed.type !== "TABLE_HELLO") {
      sendTableError(socket, "BAD_REQUEST", "First message must be TABLE_HELLO");
      return;
    }

    // A hand-typed code may arrive in any case; the generated codes are upper.
    const code = parsed.code.trim().toUpperCase();
    const table = this.tables.get(code);
    if (!table) {
      sendTableError(socket, "NO_SUCH_TABLE", "No table exists with that code");
      return;
    }

    // Bind on the code, not the token: TableRoom owns token validation, and an
    // unauthenticated socket is never added to its connection set, so it sees
    // no broadcasts and its actions are rejected.
    this.socketTables.set(socket, table);
    table.handleConnection(socket);
    table.handleRawMessage(socket, JSON.stringify({ ...parsed, code }));
  }
}
