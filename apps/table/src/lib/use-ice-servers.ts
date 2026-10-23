"use client";

import { useEffect, useState } from "react";
import type { IceServerConfig } from "@ga/contracts";
import { FALLBACK_ICE_SERVERS, fetchIceServers } from "./gateway";

/**
 * Load GET /turn once for the lifetime of a Feed. A failed request falls back
 * to public STUN so two tabs on one machine still connect; TURN is only needed
 * across restrictive networks.
 */
export function useIceServers(): IceServerConfig[] | null {
  const [servers, setServers] = useState<IceServerConfig[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchIceServers()
      .then((next) => {
        if (!cancelled) setServers(next.length > 0 ? next : FALLBACK_ICE_SERVERS);
      })
      .catch(() => {
        if (!cancelled) setServers(FALLBACK_ICE_SERVERS);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return servers;
}
