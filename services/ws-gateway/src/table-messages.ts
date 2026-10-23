import type { TableServerMessage } from "@ga/contracts";
import type { UnifiedSocket } from "./unified-socket";

/** Send a typed TABLE_ERROR, ignoring a socket that is already gone. */
export function sendTableError(socket: UnifiedSocket, code: string, message: string): void {
  const msg: TableServerMessage = { type: "TABLE_ERROR", code, message };
  try {
    socket.send(JSON.stringify(msg));
  } catch {
    // A dead socket needs no reply.
  }
}
