/**
 * The transport seam for a Table connection. Node's `ws` adapter, a Durable
 * Object WebSocket, and the in-memory test double all satisfy this shape, so
 * the room state machine never depends on a concrete socket implementation.
 */
export interface UnifiedSocket {
  send(data: string): void;
  close?(code?: number, reason?: string): void;
}
