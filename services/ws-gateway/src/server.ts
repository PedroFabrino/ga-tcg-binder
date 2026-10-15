import { WsGatewayServer } from "./node-server";
import { processCardFrame } from "../../../src/services/frame-processor";
import { identifyCard } from "../../../src/services/scanner-match";
import { db } from "../../../src/db";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || "0.0.0.0";

const server = new WsGatewayServer({ port, host });

server.roomManager.setMatcher(async (input) => {
  return identifyCard(input, db);
});

server.roomManager.setFrameProcessor(async (buffer) => {
  console.log(`[ws-gateway] >>> Received frame: ${buffer.length} bytes`);
  const result = await processCardFrame(buffer, db);
  console.log(`[ws-gateway] <<< Processed frame: phash=${result.phash}, header="${result.headerText}", footer="${result.footerText}", glare=${(result.glareRatio * 100).toFixed(1)}%`);
  console.log(`[ws-gateway] Candidates found: ${result.candidates.length}`);
  if (result.candidates.length > 0) {
    result.candidates.forEach((c, idx) => {
      console.log(`   #${idx + 1}: ${c.cardName} (${c.setPrefix} #${c.collectorNumber}) - ${c.confidence}% (visual=${(c.sVisual * 100).toFixed(1)}%, ocr=${c.sOcr !== null ? (c.sOcr * 100).toFixed(1) + "%" : "null"})`);
    });
  }
  return result.candidates;
});

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
