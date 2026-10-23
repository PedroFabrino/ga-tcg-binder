import type { TableState, TableServerMessage } from "@ga/contracts";
import type { UnifiedSocket } from "./unified-socket";

/** Shared test double for TableRoom/TableRoomManager tests. */
export class MockSocket implements UnifiedSocket {
  sent: TableServerMessage[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as TableServerMessage);
  }

  lastState(): TableState | undefined {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      const m = this.sent[i];
      if (m.type === "TABLE_STATE") return m.state;
    }
    return undefined;
  }

  errors(): string[] {
    const codes: string[] = [];
    for (const m of this.sent) {
      if (m.type === "TABLE_ERROR") codes.push(m.code);
    }
    return codes;
  }

  lastSignal(): Extract<TableServerMessage, { type: "SIGNAL" }> | undefined {
    return this.sent.find(
      (m): m is Extract<TableServerMessage, { type: "SIGNAL" }> => m.type === "SIGNAL"
    );
  }
}

export function hello(code: string, token: string, role = "seat", displayName?: string): string {
  return JSON.stringify({ type: "TABLE_HELLO", code, token, role, displayName });
}
