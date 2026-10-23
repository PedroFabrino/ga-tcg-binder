import type { IceServerConfig, IceServersResponse } from "@ga/contracts";

export interface TurnCredentials {
  urls: string | string[];
  username: string;
  credential: string;
}

const DEFAULT_STUN: IceServerConfig = { urls: "stun:stun.l.google.com:19302" };

/** STUN is always returned; TURN is added only when explicit credentials exist. */
export function buildIceServers(turn?: TurnCredentials): IceServerConfig[] {
  const servers: IceServerConfig[] = [DEFAULT_STUN];
  if (turn) {
    servers.push({ urls: turn.urls, username: turn.username, credential: turn.credential });
  }
  return servers;
}

export interface TurnEnv {
  turnUrl?: string;
  turnUsername?: string;
  turnCredential?: string;
}

/**
 * The response for GET /turn. With a full TURN config the client re-fetches
 * hourly; with STUN only it re-fetches daily. Minting truly ephemeral relay
 * credentials (e.g. via the Cloudflare Realtime API) is a follow-up behind the
 * same `TurnEnv` seam.
 */
export function getIceServersResponse(env: TurnEnv = {}): IceServersResponse {
  const { turnUrl, turnUsername, turnCredential } = env;
  if (turnUrl && turnUsername && turnCredential) {
    return {
      iceServers: buildIceServers({ urls: turnUrl, username: turnUsername, credential: turnCredential }),
      ttlSeconds: 3600,
    };
  }
  return { iceServers: buildIceServers(), ttlSeconds: 86400 };
}
