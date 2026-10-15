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

server.roomManager.setFrameProcessor(async (buffer, cropRect) => {
  console.log(`\n[ws-gateway] >>> Received frame: ${buffer.length} bytes, cropRect:`, cropRect);
  const result = await processCardFrame(buffer, db, cropRect);
  console.log(`[ws-gateway] <<< Processed frame: phash=${result.phash}`);
  console.log(`[ws-gateway] Header OCR: "${result.headerText}"`);
  console.log(`[ws-gateway] Footer OCR: "${result.footerText}"`);
  console.log(`[ws-gateway] Glare ratio: ${(result.glareRatio * 100).toFixed(1)}%`);
  console.log(`[ws-gateway] Confirmed candidates (>=50%): ${result.candidates.length}`);
  if (result.topCandidates && result.topCandidates.length > 0) {
    console.log(`[ws-gateway] Top 5 candidates evaluated:`);
    result.topCandidates.slice(0, 5).forEach((c, idx) => {
      console.log(`   #${idx + 1}: ${c.cardName} (${c.setPrefix} #${c.collectorNumber}) - ${c.confidence}% [visual=${(c.sVisual * 100).toFixed(1)}%, ocr=${c.sOcr !== null ? (c.sOcr * 100).toFixed(1) + "%" : "none"}]`);
    });
  }
  return {
    candidates: result.candidates,
    debug: {
      phash: result.phash,
      headerText: result.headerText,
      footerText: result.footerText,
      glareRatio: result.glareRatio,
      topCandidates: result.topCandidates,
      cardImageBase64: result.cardImageBase64,
      headerImageBase64: result.headerImageBase64,
      footerImageBase64: result.footerImageBase64,
    },
  };
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
