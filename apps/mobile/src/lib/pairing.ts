import type { PairingPayload } from "../types/session";

export const SESSION_CODE_LENGTH = 6;

export function parsePairingPayload(raw: string): PairingPayload | null {
  try {
    const v: unknown = JSON.parse(raw.trim());
    if (!v || typeof v !== "object") return null;
    const p = v as Record<string, unknown>;
    if (p.action !== "pair_scanner" || typeof p.sessionId !== "string" || typeof p.wsEndpoint !== "string" || typeof p.token !== "string") return null;
    return { action: "pair_scanner", sessionId: p.sessionId, wsEndpoint: p.wsEndpoint, token: p.token };
  } catch {
    return null;
  }
}

export function normalizeSessionCode(input: string): string {
  return input.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, SESSION_CODE_LENGTH);
}
