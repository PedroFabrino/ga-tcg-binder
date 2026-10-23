/**
 * The gateway lives on a different origin from the Next app (Vercel + a
 * Cloudflare Worker, or port 3003 + port 3001 in development), so the client
 * needs one explicit base URL. `NEXT_PUBLIC_GATEWAY_URL` is inlined by Next;
 * the default is the local Node gateway.
 */
const DEFAULT_GATEWAY_URL = "http://localhost:3001";

export function gatewayBaseUrl(): string {
  return process.env.NEXT_PUBLIC_GATEWAY_URL || DEFAULT_GATEWAY_URL;
}

function gatewayUrl(): URL {
  return new URL(gatewayBaseUrl());
}

/** The `/t/:code` WebSocket URL, with the code normalized to upper case. */
export function tableWebSocketUrl(code: string): string {
  const url = gatewayUrl();
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/t/${code.toUpperCase()}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
