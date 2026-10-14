"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_QUALITY_GATE,
  type QualityGateConfig,
  type Quad,
  type Rect,
  type ScanFrameMetrics,
} from "@/lib/scanner/contracts";
import { detectCardQuad, loadOpenCv } from "@/lib/scanner/detector";
import { evaluateFrame, glareRatio, laplacianVariance } from "@/lib/scanner/quality-gate";
import { guideRect, normalizeCapture, type NormalizedCapture } from "@/lib/scanner/warp";

const TARGET_FPS = 12;

interface Options {
  config?: QualityGateConfig;
  enabled?: boolean;
  /** Called once when the gate reports `ready` (auto-capture). */
  onAutoCapture?: (capture: NormalizedCapture) => void;
}

export function useScannerCamera({ config = DEFAULT_QUALITY_GATE, enabled = true, onAutoCapture }: Options = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const metricsRef = useRef<ScanFrameMetrics | null>(null);
  const capturingRef = useRef(false);
  const onAutoRef = useRef(onAutoCapture);
  onAutoRef.current = onAutoCapture;

  const [metrics, setMetrics] = useState<ScanFrameMetrics | null>(null);
  const [error, setError] = useState("");
  const [cvReady, setCvReady] = useState(false);

  const grabGuide = useCallback((): Rect | null => {
    const v = videoRef.current;
    return v && v.videoWidth ? guideRect(v.videoWidth, v.videoHeight) : null;
  }, []);

  const capture = useCallback(
    async (trigger: "auto" | "manual"): Promise<NormalizedCapture | null> => {
      const v = videoRef.current;
      const guide = grabGuide();
      if (!v || !guide || capturingRef.current) return null;
      capturingRef.current = true;
      try {
        const frame = document.createElement("canvas");
        frame.width = v.videoWidth;
        frame.height = v.videoHeight;
        frame.getContext("2d")!.drawImage(v, 0, 0);
        const quad: Quad | null = metricsRef.current?.quad ?? null;
        return await normalizeCapture(frame, quad, guide, trigger);
      } finally {
        capturingRef.current = false;
      }
    },
    [grabGuide]
  );

  // Camera stream
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920, min: 1920 }, height: { ideal: 1080, min: 1080 } },
        audio: false,
      })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }))
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch((e: Error) => setError(e.message || "Camera unavailable"));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled]);

  // Analysis loop
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const work = document.createElement("canvas");
    const wctx = work.getContext("2d", { willReadFrequently: true })!;

    loadOpenCv()
      .then((cv) => {
        if (stop) return;
        setCvReady(true);
        const tick = () => {
          if (stop) return;
          const v = videoRef.current;
          if (v && v.videoWidth && !capturingRef.current) {
            const guide = guideRect(v.videoWidth, v.videoHeight);
            work.width = v.videoWidth;
            work.height = v.videoHeight;
            wctx.drawImage(v, 0, 0);
            const det = detectCardQuad(cv, wctx.getImageData(0, 0, work.width, work.height), guide);
            const s = det.scale;
            const q = det.quad?.map((p) => ({ x: p.x * s, y: p.y * s })) as Quad | undefined;
            const sharpness = det.quad && q ? laplacianVariance(det.gray, det.width, det.height) : 0;
            const glare = q ? glareRatio(det.gray, det.width, det.height, q, config.glareLuminance) : 0;
            const next = evaluateFrame(
              { guide, quad: det.quad, sharpness, glare, timestamp: Date.now() },
              metricsRef.current,
              config
            );
            metricsRef.current = next;
            setMetrics(next);
            if (next.verdict === "ready") {
              void capture("auto").then((c) => c && onAutoRef.current?.(c));
              metricsRef.current = { ...next, stableFrames: 0 };
            }
          }
          timer = setTimeout(tick, 1000 / TARGET_FPS);
        };
        tick();
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [enabled, config, capture]);

  return { videoRef, metrics, error, cvReady, capture, getGuide: grabGuide };
}
