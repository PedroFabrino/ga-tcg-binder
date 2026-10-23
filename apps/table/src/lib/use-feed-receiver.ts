"use client";

import { useEffect, useState } from "react";
import type { FeedSignaling, IceServerConfig } from "@ga/contracts";
import { FeedConnection } from "./webrtc";

export interface UseFeedReceiverOptions {
  /** True only when the opponent's Capture Device is present and this socket is open. */
  enabled: boolean;
  signaling: FeedSignaling;
  iceServers: IceServerConfig[];
}

/**
 * The desktop side of one Feed. The receiver offers; a capture replacement or
 * a reconnect (enabled false -> true) builds a fresh peer connection, and a
 * browser `online` event asks the current one to restart ICE.
 */
export function useFeedReceiver(options: UseFeedReceiverOptions): MediaStream | null {
  const { enabled, signaling, iceServers } = options;
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStream(null);
      return;
    }

    let cancelled = false;
    let connection: FeedConnection | null = null;

    try {
      connection = new FeedConnection({
        role: "receiver",
        signaling,
        iceServers,
        onTrack: (next) => {
          if (!cancelled) setStream(next);
        },
      });
      void connection.offer().catch((error) => {
        console.warn("[feed] offer failed", error);
      });
    } catch (error) {
      console.warn("[feed] could not create the receiver", error);
    }

    const onOnline = () => {
      void connection?.restartIce().catch((error) => {
        console.warn("[feed] ICE restart failed", error);
      });
    };
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      connection?.close();
      setStream(null);
    };
  }, [enabled, signaling, iceServers]);

  return stream;
}
