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
  const [cameraReady, setCameraReady] = useState(false);
  const [cvReady, setCvReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

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

  const requestCamera = useCallback(async () => {
    setError("");
    setPermissionDenied(false);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported on this browser or page is not served over HTTPS.");
      setPermissionDenied(true);
      return;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
      {
        video: { facingMode: "environment" },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let lastErr: any;
    for (const c of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (e) {
            console.warn("video.play() failed:", e);
          }
        }
        setCameraReady(true);
        setError("");
        setPermissionDenied(false);
        return;
      } catch (err: any) {
        lastErr = err;
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionDenied(true);
          setError("Camera permission was denied. Please allow camera access in your browser settings to scan cards.");
          return;
        }
      }
    }

    setError(lastErr?.message || "Could not access camera. Please verify device permissions.");
  }, []);

  // Initialize camera
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    requestCamera().catch((e) => {
      if (!cancelled) setError(e.message || "Failed to start camera");
    });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [enabled, requestCamera]);

  // Load OpenCV in the background without blocking camera stream or UI
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadOpenCv()
      .then(() => {
        if (!cancelled) setCvReady(true);
      })
      .catch((e: Error) => {
        console.warn("OpenCV background load:", e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Analysis loop - runs gently at ~10 FPS with GPU downscale to guarantee zero UI lag
  useEffect(() => {
    if (!enabled || !cvReady || !cameraReady) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let busy = false;

    const work = document.createElement("canvas");
    const wctx = work.getContext("2d", { willReadFrequently: true })!;

    const cv = window.cv;
    if (!cv) return;

    const tick = () => {
      if (stop) return;
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && !capturingRef.current && !busy) {
        busy = true;
        try {
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          const guide = guideRect(vw, vh);

          // Fast canvas downscale
          const targetWidth = 480;
          const scale = Math.min(1, targetWidth / vw);
          const aw = Math.round(vw * scale);
          const ah = Math.round(vh * scale);

          if (work.width !== aw || work.height !== ah) {
            work.width = aw;
            work.height = ah;
          }

          wctx.drawImage(v, 0, 0, aw, ah);
          const imgData = wctx.getImageData(0, 0, aw, ah);

          const det = detectCardQuad(cv, imgData, guide, scale);
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

          setMetrics((prev) => {
            if (
              prev?.verdict !== next.verdict ||
              prev?.hint !== next.hint ||
              prev?.stableFrames !== next.stableFrames
            ) {
              return next;
            }
            return prev;
          });

          if (next.verdict === "ready") {
            void capture("auto").then((c) => c && onAutoRef.current?.(c));
            metricsRef.current = { ...next, stableFrames: 0 };
          }
        } catch (err) {
          console.error("Frame analysis error:", err);
        } finally {
          busy = false;
        }
      }

      timer = setTimeout(tick, 100);
    };

    timer = setTimeout(tick, 200);

    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [enabled, cvReady, cameraReady, config, capture]);

  return {
    videoRef,
    metrics,
    error,
    cameraReady,
    cvReady,
    permissionDenied,
    requestCamera,
    capture,
    getGuide: grabGuide,
  };
}
