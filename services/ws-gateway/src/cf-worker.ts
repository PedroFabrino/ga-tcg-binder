import { SessionRoomManager, type UnifiedSocket } from "./room-manager";

const globalRoomManager = new SessionRoomManager();

export interface Env {
  // Optional bindings for Cloudflare Workers
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          activeRooms: globalRoomManager.getRoomCount(),
          runtime: "cloudflare-workers",
          timestamp: Date.now(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket Upgrade", { status: 426 });
    }

    // Cloudflare Workers WebSocketPair
    // @ts-ignore - WebSocketPair is available in Cloudflare Workers global scope
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair) as [any, any];

    server.accept();

    const unifiedSocket: UnifiedSocket = {
      send: (data: string) => server.send(data),
      close: (code?: number, reason?: string) => server.close(code, reason),
    };

    globalRoomManager.handleConnection(unifiedSocket);

    server.addEventListener("message", (event: any) => {
      globalRoomManager.handleRawMessage(unifiedSocket, event.data.toString());
    });

    server.addEventListener("close", () => {
      globalRoomManager.handleDisconnect(unifiedSocket);
    });

    server.addEventListener("error", () => {
      globalRoomManager.handleDisconnect(unifiedSocket);
    });

    return new Response(null, {
      status: 101,
      // @ts-ignore
      webSocket: client,
    });
  },
};
