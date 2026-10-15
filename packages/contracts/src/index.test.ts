import { describe, it, expect } from "vitest";
import {
  isWsClientMessage,
  isWsServerMessage,
  CARD_W,
  CARD_H,
  CARD_ASPECT,
  DEFAULT_QUALITY_GATE,
  type WsJoinMessage,
  type WsScanIdentifyResponse,
} from "./index";

describe("@ga/contracts", () => {
  it("exports valid card aspect ratio and dimensions", () => {
    expect(CARD_W).toBe(630);
    expect(CARD_H).toBe(880);
    expect(CARD_ASPECT).toBeCloseTo(2.5 / 3.5, 4);
    expect(DEFAULT_QUALITY_GATE.minSharpness).toBe(70);
  });

  it("validates WsClientMessage type guard", () => {
    const validJoin: WsJoinMessage = {
      type: "SESSION_JOIN",
      sessionId: "sess_123",
      token: "tok_abc",
      role: "scanner",
      timestamp: Date.now(),
      deviceName: "iPhone 15 Pro",
    };
    expect(isWsClientMessage(validJoin)).toBe(true);

    expect(isWsClientMessage(null)).toBe(false);
    expect(isWsClientMessage({})).toBe(false);
    expect(isWsClientMessage({ type: "UNKNOWN", sessionId: "123" })).toBe(false);
  });

  it("validates WsServerMessage type guard", () => {
    const validResponse: WsScanIdentifyResponse = {
      type: "SCAN_IDENTIFY_RESPONSE",
      sessionId: "sess_123",
      requestId: "req_1",
      timestamp: Date.now(),
      candidates: [
        {
          editionId: "ed_1",
          cardSlug: "fire-slash",
          cardName: "Fire Slash",
          setPrefix: "DOA",
          collectorNumber: "001",
          imageUrl: "https://example.com/art.webp",
          confidence: 94.5,
          sVisual: 0.92,
          sOcr: 0.98,
          signals: { collectorMatch: true, ocrFallback: false },
        },
      ],
    };
    expect(isWsServerMessage(validResponse)).toBe(true);
    expect(isWsServerMessage({ type: "INVALID" })).toBe(false);
  });
});
