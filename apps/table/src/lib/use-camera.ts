"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";

/**
 * 720p30, rear camera when there is one, with `detail` so the encoder keeps
 * card text sharp instead of smoothing it away. All dimensions are `ideal`:
 * a desktop webcam or a device without 720p still works.
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
};

export interface UseCameraResult {
  stream: MediaStream | null;
  status: CameraStatus;
  retry: () => void;
}

export function useCamera(): UseCameraResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        return;
      }

      setStatus("requesting");
      try {
        const next = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }

        const track = next.getVideoTracks()[0];
        if (!track) {
          next.getTracks().forEach((item) => item.stop());
          setStatus("error");
          return;
        }

        track.contentHint = "detail";
        streamRef.current = next;
        setStream(next);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setStatus("requesting");
    setAttempt((value) => value + 1);
  }, []);

  return { stream, status, retry };
}
