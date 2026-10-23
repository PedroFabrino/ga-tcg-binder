"use client";

import { useEffect, useState } from "react";

export type WakeLockStatus = "requesting" | "active" | "unavailable";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

/**
 * Ask the phone to keep its screen on while it is the Capture Device. The API
 * is secure-context only and may be absent; "unavailable" is an honest state,
 * not an error that blocks the camera.
 */
export function useWakeLock(): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>("requesting");

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock) {
      setStatus("unavailable");
      return;
    }

    let cancelled = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const request = async () => {
      if (cancelled || sentinel || document.visibilityState !== "visible") return;
      setStatus("requesting");
      try {
        const lock = await wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
        setStatus("active");
        lock.addEventListener("release", () => {
          sentinel = null;
          if (cancelled) return;
          setStatus("requesting");
          if (document.visibilityState === "visible") void request();
        });
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinel) void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release();
    };
  }, []);

  return status;
}
