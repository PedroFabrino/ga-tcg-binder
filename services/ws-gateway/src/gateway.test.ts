import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { WsGatewayServer } from "./node-server";
import type {
  WsJoinMessage,
  WsStatusMessage,
  WsCardCommittedMessage,
  WsBroadcastCommittedMessage,
  WsPingMessage,
  WsPongMessage,
  WsCardUpdateFinishMessage,
  WsBroadcastFinishUpdateMessage,
} from "@ga/contracts";

function createClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", (err) => reject(err));
  });
}

function nextMessage<T>(ws: WebSocket): Promise<T> {
  return new Promise((resolve) => {
    ws.once("message", (raw) => {
      resolve(JSON.parse(raw.toString()));
    });
  });
}

describe("WebSocket Session Gateway Integration", () => {
  let server: WsGatewayServer;
  let port: number;

  beforeAll(async () => {
    // Port 0 picks any free port
    server = new WsGatewayServer({ port: 0 });
    port = await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("handles health check endpoint", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(typeof data.activeRooms).toBe("number");
  });

  it("returns ICE servers from /turn", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/turn`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.iceServers)).toBe(true);
    expect(data.iceServers[0].urls).toContain("stun:");
    expect(typeof data.ttlSeconds).toBe("number");
  });

  it("pairs desktop receiver and mobile scanner in the same room", async () => {
    const sessionId = "sess_test_pairing";
    const token = "tok_test_123";

    const desktop = await createClient(port);
    const mobile = await createClient(port);

    // Desktop joins as receiver
    const desktopJoinPromise = nextMessage<WsStatusMessage>(desktop);
    const desktopJoin: WsJoinMessage = {
      type: "SESSION_JOIN",
      sessionId,
      token,
      role: "receiver",
      timestamp: Date.now(),
    };
    desktop.send(JSON.stringify(desktopJoin));

    const initialStatus = await desktopJoinPromise;
    expect(initialStatus.type).toBe("SESSION_STATUS");
    expect(initialStatus.status).toBe("waiting_for_companion");
    expect(initialStatus.activeScanners).toBe(0);

    // Mobile joins as scanner
    const desktopPairedPromise = nextMessage<WsStatusMessage>(desktop);
    const mobileStatusPromise = nextMessage<WsStatusMessage>(mobile);

    const mobileJoin: WsJoinMessage = {
      type: "SESSION_JOIN",
      sessionId,
      token,
      role: "scanner",
      deviceName: "Pixel 9 Pro",
      timestamp: Date.now(),
    };
    mobile.send(JSON.stringify(mobileJoin));

    const [statusOnDesktop, statusOnMobile] = await Promise.all([
      desktopPairedPromise,
      mobileStatusPromise,
    ]);

    expect(statusOnDesktop.status).toBe("paired");
    expect(statusOnDesktop.pairedDevice).toBe("Pixel 9 Pro");
    expect(statusOnDesktop.activeScanners).toBe(1);

    expect(statusOnMobile.status).toBe("paired");
    expect(statusOnMobile.pairedDevice).toBe("Pixel 9 Pro");

    // Scanner commits a card
    const desktopCardPromise = nextMessage<WsBroadcastCommittedMessage>(desktop);
    const cardMsg: WsCardCommittedMessage = {
      type: "CARD_COMMITTED",
      sessionId,
      timestamp: Date.now(),
      card: {
        editionId: "ed_flame_blade",
        cardSlug: "flame-blade",
        cardName: "Flame Blade",
        setPrefix: "DOA",
        collectorNumber: "005",
        imageUrl: "https://example.com/card.webp",
        foil: true,
        confidence: 96,
        timestamp: Date.now(),
      },
    };
    mobile.send(JSON.stringify(cardMsg));

    const broadcast = await desktopCardPromise;
    expect(broadcast.type).toBe("CARD_BROADCAST");
    expect(broadcast.card.cardName).toBe("Flame Blade");
    expect(broadcast.card.foil).toBe(true);

    // Scanner updates finish to non-foil
    const desktopFinishPromise = nextMessage<WsBroadcastFinishUpdateMessage>(desktop);
    const finishMsg: WsCardUpdateFinishMessage = {
      type: "CARD_UPDATE_FINISH",
      sessionId,
      timestamp: Date.now(),
      editionId: "ed_flame_blade",
      foil: false,
    };
    mobile.send(JSON.stringify(finishMsg));

    const finishUpdate = await desktopFinishPromise;
    expect(finishUpdate.type).toBe("CARD_FINISH_UPDATED");
    expect(finishUpdate.foil).toBe(false);

    // Ping / Pong heartbeat
    const mobilePongPromise = nextMessage<WsPongMessage>(mobile);
    const pingMsg: WsPingMessage = {
      type: "SESSION_PING",
      sessionId,
      timestamp: Date.now(),
    };
    mobile.send(JSON.stringify(pingMsg));

    const pong = await mobilePongPromise;
    expect(pong.type).toBe("SESSION_PONG");

    // Scanner disconnects -> Desktop notified
    const desktopDisconnectPromise = nextMessage<WsStatusMessage>(desktop);
    mobile.close();

    const afterDisconnect = await desktopDisconnectPromise;
    expect(afterDisconnect.type).toBe("SESSION_STATUS");
    expect(afterDisconnect.status).toBe("waiting_for_companion");
    expect(afterDisconnect.activeScanners).toBe(0);

    desktop.close();
  });

  it("strictly isolates different rooms", async () => {
    const roomA = "sess_room_A";
    const roomB = "sess_room_B";

    const clientA = await createClient(port);
    const clientB = await createClient(port);

    // Client A joins Room A
    clientA.send(
      JSON.stringify({
        type: "SESSION_JOIN",
        sessionId: roomA,
        token: "tokA",
        role: "receiver",
        timestamp: Date.now(),
      })
    );
    await nextMessage(clientA);

    // Client B joins Room B
    clientB.send(
      JSON.stringify({
        type: "SESSION_JOIN",
        sessionId: roomB,
        token: "tokB",
        role: "receiver",
        timestamp: Date.now(),
      })
    );
    await nextMessage(clientB);

    // Scanner joins Room A and sends message
    const scannerA = await createClient(port);
    scannerA.send(
      JSON.stringify({
        type: "SESSION_JOIN",
        sessionId: roomA,
        token: "tokA",
        role: "scanner",
        timestamp: Date.now(),
      })
    );
    await nextMessage(clientA); // paired status

    let bReceivedUnexpectedMessage = false;
    clientB.once("message", () => {
      bReceivedUnexpectedMessage = true;
    });

    // Scanner A sends card commit in Room A
    const aCardPromise = nextMessage<WsBroadcastCommittedMessage>(clientA);
    scannerA.send(
      JSON.stringify({
        type: "CARD_COMMITTED",
        sessionId: roomA,
        timestamp: Date.now(),
        card: {
          editionId: "ed_secret",
          cardSlug: "secret",
          cardName: "Secret Card",
          setPrefix: "DOA",
          collectorNumber: "999",
          imageUrl: "",
          foil: false,
          confidence: 99,
          timestamp: Date.now(),
        },
      })
    );

    const receivedA = await aCardPromise;
    expect(receivedA.card.cardName).toBe("Secret Card");

    // Give 50ms to ensure clientB received nothing
    await new Promise((r) => setTimeout(r, 50));
    expect(bReceivedUnexpectedMessage).toBe(false);

    clientA.close();
    clientB.close();
    scannerA.close();
  });

  it("handles SCAN_IDENTIFY_REQUEST and responds with ranked candidates", async () => {
    // Configure mock matcher on roomManager
    server.roomManager.setMatcher(async (req) => {
      expect(req.phash).toBe("0123456789abcdef");
      expect(req.headerText).toBe("Rend");
      return [
        {
          editionId: "ed_rend",
          cardSlug: "rend",
          cardName: "Rend",
          setPrefix: "DOA",
          collectorNumber: "010",
          imageUrl: "https://example.com/rend.jpg",
          confidence: 95.2,
          sVisual: 0.94,
          sOcr: 0.97,
          signals: { collectorMatch: true, ocrFallback: false },
        },
      ];
    });

    const sessionId = "sess_identify_test";
    const client = await createClient(port);

    client.send(
      JSON.stringify({
        type: "SESSION_JOIN",
        sessionId,
        token: "tok_id",
        role: "scanner",
        timestamp: Date.now(),
      })
    );
    await nextMessage(client);

    const identifyPromise = nextMessage<any>(client);
    client.send(
      JSON.stringify({
        type: "SCAN_IDENTIFY_REQUEST",
        sessionId,
        requestId: "req_test_1",
        timestamp: Date.now(),
        phash: "0123456789abcdef",
        headerText: "Rend",
        footerText: "DOA 010",
      })
    );

    const res = await identifyPromise;
    expect(res.type).toBe("SCAN_IDENTIFY_RESPONSE");
    expect(res.requestId).toBe("req_test_1");
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0].cardName).toBe("Rend");
    expect(res.candidates[0].confidence).toBe(95.2);

    client.close();
  });
});
