"use client";

import { useEffect, useState } from "react";

/**
 * A muted (not ended) track is how iOS reports a locked camera. The caller
 * keeps the last frame visible and overlays the asleep badge instead of
 * pretending the Feed is live.
 */
export function useTrackMuted(stream: MediaStream | null): boolean {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
    if (!track) {
      setMuted(false);
      return;
    }

    const sync = () => setMuted(track.muted);
    sync();
    track.addEventListener("mute", sync);
    track.addEventListener("unmute", sync);
    track.addEventListener("ended", sync);

    return () => {
      track.removeEventListener("mute", sync);
      track.removeEventListener("unmute", sync);
      track.removeEventListener("ended", sync);
    };
  }, [stream]);

  return muted;
}
