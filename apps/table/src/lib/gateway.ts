import { isIceServersResponse, type IceServerConfig } from "@ga/contracts";

/**
 * The gateway lives on a different origin from the Next app (Vercel + a
 * Cloudflare Worker, or port 3003 + port 3001 in development), so the client
 * needs one explicit base URL. `NEXT_PUBLIC_GATEWAY_URL` is inlined by Next;
 * the default is the local Node gateway.
 */
const DEFAULT_GATEWAY_URL = "http://localhost:3001";

/** Keep a local-only Feed usable when GET /turn is briefly unavailable. */
export const FALLBACK_ICE_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

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

/**
 * Fetch the short-lived ICE servers for a Feed. The response is validated at the
 * boundary; callers may fall back to `FALLBACK_ICE_SERVERS` for local play.
 */
export async function fetchIceServers(
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  baseUrl: string = gatewayBaseUrl()
): Promise<IceServerConfig[]> {
  const endpoint = new URL("/turn", baseUrl).toString();
  const response = await fetcher(endpoint, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`ICE server request failed with status ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!isIceServersResponse(body)) {
    throw new Error("ICE server request returned an unexpected response");
  }

  return body.iceServers;
}
