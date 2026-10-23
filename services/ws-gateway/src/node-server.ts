import http, { type ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { SessionRoomManager, type UnifiedSocket } from "./room-manager";
import { TableRoomManager } from "./table-room-manager";
import { getIceServersResponse } from "./turn";

/** Table sockets live on their own path so scanner sessions stay untouched. */
export const TABLE_WS_PATH = "/ws/table";

export interface WsGatewayServerOptions {
  port?: number;
  host?: string;
  roomManager?: SessionRoomManager;
  tableManager?: TableRoomManager;
}

/** The minimum a socket needs; both the scanner sessions and table rooms fit it. */
interface SocketHandler {
  handleConnection(socket: UnifiedSocket): void;
  handleRawMessage(socket: UnifiedSocket, rawData: string): void;
  handleDisconnect(socket: UnifiedSocket): void;
}

// Dev-only: the Next app runs on another localhost port. Production is same-origin.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS_HEADERS });
  res.end(JSON.stringify(body));
}

/** Strip the query string without URL parsing, which can throw on odd targets. */
function pathnameOf(url: string | undefined): string {
  if (!url) return "/";
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

export class WsGatewayServer {
  public readonly port: number;
  public readonly host: string;
  public readonly roomManager: SessionRoomManager;
  public readonly tableManager: TableRoomManager;
  private httpServer: http.Server | null = null;
  private scannerWss: WebSocketServer | null = null;
  private tableWss: WebSocketServer | null = null;

  constructor(options: WsGatewayServerOptions = {}) {
    this.port = options.port ?? 3001;
    this.host = options.host ?? "0.0.0.0";
    this.roomManager = options.roomManager ?? new SessionRoomManager();
    this.tableManager = options.tableManager ?? new TableRoomManager();
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        const pathname = pathnameOf(req.url);

        if (req.method === "OPTIONS") {
          res.writeHead(204, CORS_HEADERS);
          res.end();
          return;
        }

        if (pathname === "/health") {
          sendJson(res, 200, {
            status: "ok",
            activeRooms: this.roomManager.getRoomCount(),
            activeTables: this.tableManager.getTableCount(),
            timestamp: Date.now(),
          });
          return;
        }

        if (pathname === "/turn") {
          sendJson(
            res,
            200,
            getIceServersResponse({
              turnUrl: process.env.TURN_URL,
              turnUsername: process.env.TURN_USERNAME,
              turnCredential: process.env.TURN_CREDENTIAL,
            })
          );
          return;
        }

        if (req.method === "POST" && pathname === "/api/table") {
          sendJson(res, 201, this.tableManager.createTable());
          return;
        }

        sendJson(res, 404, { error: "Not found" });
      });

      // noServer + explicit routing: two `server`-bound WebSocketServers would
      // abort each other's handshake, because handleUpgrade kills non-matching paths.
      const scannerWss = new WebSocketServer({ noServer: true });
      const tableWss = new WebSocketServer({ noServer: true });
      this.scannerWss = scannerWss;
      this.tableWss = tableWss;

      scannerWss.on("connection", (ws) => this.bindSocket(ws, this.roomManager));
      tableWss.on("connection", (ws) => this.bindSocket(ws, this.tableManager));

      this.httpServer.on("upgrade", (req, socket, head) => {
        const target = pathnameOf(req.url) === TABLE_WS_PATH ? tableWss : scannerWss;
        target.handleUpgrade(req, socket, head, (ws) => {
          target.emit("connection", ws, req);
        });
      });

      this.httpServer.listen(this.port, this.host, () => {
        const addr = this.httpServer?.address();
        const actualPort = typeof addr === "object" && addr ? addr.port : this.port;
        resolve(actualPort);
      });

      this.httpServer.on("error", (err) => reject(err));
    });
  }

  public async stop(): Promise<void> {
    await Promise.all([this.closeWss(this.scannerWss), this.closeWss(this.tableWss)]);
    await new Promise<void>((resolve) => {
      if (!this.httpServer) {
        resolve();
        return;
      }
      this.httpServer.close(() => resolve());
      this.httpServer.closeIdleConnections();
    });
  }

  private bindSocket(ws: WebSocket, handler: SocketHandler): void {
    const unifiedSocket: UnifiedSocket = {
      send: (data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      },
      close: (code?: number, reason?: string) => ws.close(code, reason),
    };

    handler.handleConnection(unifiedSocket);

    ws.on("message", (raw) => handler.handleRawMessage(unifiedSocket, raw.toString()));
    ws.on("close", () => handler.handleDisconnect(unifiedSocket));
    ws.on("error", () => handler.handleDisconnect(unifiedSocket));
  }

  private closeWss(wss: WebSocketServer | null): Promise<void> {
    return new Promise((resolve) => {
      if (!wss) {
        resolve();
        return;
      }
      for (const client of wss.clients) {
        client.terminate();
      }
      wss.close(() => resolve());
    });
  }
}
