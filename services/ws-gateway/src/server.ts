import { WsGatewayServer } from "./node-server";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || "0.0.0.0";

const server = new WsGatewayServer({ port, host });

server.start().then((actualPort) => {
  console.log(`[ws-gateway] Real-Time Session Gateway listening on ws://${host}:${actualPort}`);
  console.log(`[ws-gateway] Health check available at http://${host}:${actualPort}/health`);
});

process.on("SIGINT", async () => {
  console.log("\n[ws-gateway] Shutting down...");
  await server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.stop();
  process.exit(0);
});
