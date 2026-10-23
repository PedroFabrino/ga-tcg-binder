import type { TableCredentials } from "@ga/contracts";

/** 32 unambiguous characters: no 0/O or 1/I to mistype. 256 is divisible by 32. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const TOKEN_BYTES = 16;

/**
 * Platform-neutral credential generation. `crypto.getRandomValues` exists in
 * both Node (20+) and Cloudflare Workers, so the same code serves the dev
 * gateway and the Durable Object.
 */
export function generateTableCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function generateTableToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createTableCredentials(code = generateTableCode()): TableCredentials {
  return {
    code,
    p1Token: generateTableToken(),
    p2Token: generateTableToken(),
    viewerToken: generateTableToken(),
  };
}
