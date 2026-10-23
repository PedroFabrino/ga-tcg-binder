import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { SessionRoomManager } from "./room-manager";
import { getIceServersResponse } from "./turn";

export interface WsGatewayServerOptions {
  port?: number;
  host?: string;
  roomManager?: SessionRoomManager;
}

export class WsGatewayServer {
  public readonly port: number;
  public readonly host: string;
  public readonly roomManager: SessionRoomManager;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(options: WsGatewayServerOptions = {}) {
    this.port = options.port ?? 3001;
    this.host = options.host ?? "0.0.0.0";
    this.roomManager = options.roomManager ?? new SessionRoomManager();
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        if (req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "ok",
              activeRooms: this.roomManager.getRoomCount(),
              timestamp: Date.now(),
            })
          );
          return;
        }

        if (req.url === "/turn") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify(
              getIceServersResponse({
                turnUrl: process.env.TURN_URL,
                turnUsername: process.env.TURN_USERNAME,
                turnCredential: process.env.TURN_CREDENTIAL,
              })
            )
          );
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      });

      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on("connection", (ws: WebSocket) => {
        const unifiedSocket = {
          send: (data: string) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          },
          close: (code?: number, reason?: string) => ws.close(code, reason),
        };

        this.roomManager.handleConnection(unifiedSocket);

        ws.on("message", (raw) => {
          this.roomManager.handleRawMessage(unifiedSocket, raw.toString());
        });

        ws.on("close", () => {
          this.roomManager.handleDisconnect(unifiedSocket);
        });

        ws.on("error", () => {
          this.roomManager.handleDisconnect(unifiedSocket);
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
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => resolve());
          } else {
            resolve();
          }
        });
      } else if (this.httpServer) {
        this.httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
