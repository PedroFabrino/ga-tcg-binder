import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { WsGatewayServer, TABLE_WS_PATH } from "./node-server";
import type {
  WsJoinMessage,
  WsStatusMessage,
  WsCardCommittedMessage,
  WsBroadcastCommittedMessage,
  WsPingMessage,
  WsPongMessage,
  WsCardUpdateFinishMessage,
  WsBroadcastFinishUpdateMessage,
  TableCredentials,
  TableServerMessage,
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

  describe("Table gateway integration", () => {
    async function createTable(): Promise<TableCredentials> {
      const res = await fetch(`http://127.0.0.1:${port}/api/table`, { method: "POST" });
      expect(res.status).toBe(201);
      return (await res.json()) as TableCredentials;
    }

    function openTable(): Promise<WebSocket> {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${TABLE_WS_PATH}`);
        ws.on("open", () => resolve(ws));
        ws.on("error", reject);
      });
    }

    /** Buffers table messages so tests can wait for a type without racing PRESENCE. */
    function collect(ws: WebSocket) {
      const messages: TableServerMessage[] = [];
      ws.on("message", (raw) => {
        messages.push(JSON.parse(raw.toString()) as TableServerMessage);
      });

      return {
        async waitFor<T extends TableServerMessage["type"]>(
          type: T,
          timeoutMs = 2000
        ): Promise<Extract<TableServerMessage, { type: T }>> {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            const index = messages.findIndex((m) => m.type === type);
            if (index !== -1) {
              const [msg] = messages.splice(index, 1);
              return msg as Extract<TableServerMessage, { type: T }>;
            }
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
          throw new Error(`Timed out waiting for ${type}`);
        },
      };
    }

    function helloSocket(code: string, token: string, displayName: string): string {
      return JSON.stringify({ type: "TABLE_HELLO", code, token, role: "seat", displayName });
    }

    it("creates a table over HTTP", async () => {
      const creds = await createTable();
      expect(creds.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(new Set([creds.p1Token, creds.p2Token, creds.viewerToken]).size).toBe(3);
    });

    it("routes TABLE_HELLO and mirrors two seats end to end", async () => {
      const creds = await createTable();
      const p1 = await openTable();
      const p2 = await openTable();
      const q1 = collect(p1);
      const q2 = collect(p2);

      p1.send(helloSocket(creds.code, creds.p1Token, "Alice"));
      const joined = await q1.waitFor("TABLE_STATE");
      expect(joined.state.seats.p1?.displayName).toBe("Alice");

      p2.send(helloSocket(creds.code, creds.p2Token, "Bob"));
      const both = await q2.waitFor("TABLE_STATE");
      expect(both.state.seats.p1?.displayName).toBe("Alice");
      expect(both.state.seats.p2?.displayName).toBe("Bob");

      p1.send(JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 4 } }));
      expect((await q2.waitFor("TABLE_STATE")).state.seats.p1?.damage).toBe(4);

      p1.send(JSON.stringify({ type: "TURN_START" }));
      expect((await q2.waitFor("TABLE_STATE")).state.active).toBe("p1");

      p1.send(JSON.stringify({ type: "TURN_END" }));
      expect((await q2.waitFor("TABLE_STATE")).state.active).toBeNull();

      p1.send(JSON.stringify({ type: "PIN_SET", cardSlug: "cremation-ritual" }));
      expect((await q2.waitFor("TABLE_STATE")).state.pins.p1?.cardSlug).toBe("cremation-ritual");

      p1.close();
      p2.close();
    });

    it("forwards a disconnect to the room", async () => {
      const creds = await createTable();
      const p1 = await openTable();
      const p2 = await openTable();
      const q1 = collect(p1);
      const q2 = collect(p2);

      p1.send(helloSocket(creds.code, creds.p1Token, "Alice"));
      await q1.waitFor("TABLE_STATE");

      p2.send(helloSocket(creds.code, creds.p2Token, "Bob"));
      await q2.waitFor("TABLE_STATE");

      p1.close();

      const after = await q2.waitFor("TABLE_STATE");
      expect(after.state.log.some((e) => e.kind === "disconnect" && e.seat === "p1")).toBe(true);

      p2.close();
    });

    it("rejects an unknown table code", async () => {
      const client = await openTable();
      const inbox = collect(client);

      client.send(helloSocket("ZZZZZZ", "tok", "Nobody"));

      const err = await inbox.waitFor("TABLE_ERROR");
      expect(err.code).toBe("NO_SUCH_TABLE");
      client.close();
    });

    it("rejects a first message that is not TABLE_HELLO", async () => {
      const client = await openTable();
      const inbox = collect(client);

      client.send(JSON.stringify({ type: "TURN_START" }));

      const err = await inbox.waitFor("TABLE_ERROR");
      expect(err.code).toBe("BAD_REQUEST");
      client.close();
    });
  });
});
