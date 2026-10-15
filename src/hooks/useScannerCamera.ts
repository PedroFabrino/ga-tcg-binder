"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_QUALITY_GATE,
  type QualityGateConfig,
  type Quad,
  type Rect,
  type ScanFrameMetrics,
} from "@/lib/scanner/contracts";
import { detectCardQuad } from "@/lib/scanner/detector";
import { evaluateFrame, glareRatio, laplacianVariance } from "@/lib/scanner/quality-gate";
import { guideRect, normalizeCapture, rectToQuad, type NormalizedCapture } from "@/lib/scanner/warp";
import { logScanner } from "@/lib/scanner/debug-client";

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
  const [cvReady, setCvReady] = useState(true); // Pure TS scanner is ready immediately
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraStage, setCameraStage] = useState<string>("idle");

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
        logScanner("capture", `Capturing frame (${trigger})`, {
          videoWidth: v.videoWidth,
          videoHeight: v.videoHeight,
          hasQuad: Boolean(quad),
        });
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
    setCameraStage("probing");

    logScanner("init", "Starting camera initialization probe", {
      isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
      protocol: typeof location !== "undefined" ? location.protocol : "unknown",
      hasNavigator: typeof navigator !== "undefined",
      hasMediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
      hasGetUserMedia: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    });

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg =
        typeof window !== "undefined" && !window.isSecureContext
          ? "Camera requires a secure context (HTTPS). Please open this site via HTTPS."
          : "Camera is not supported on this browser/webview.";
      logScanner("init_error", msg, {}, "error");
      setError(msg);
      setPermissionDenied(true);
      setCameraStage("unsupported");
      return;
    }

    // Stop existing stream if active
    if (streamRef.current) {
      logScanner("cleanup", "Stopping existing media tracks before requesting new stream");
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // List devices if permitted
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      logScanner("enumerate_devices", `Found ${videoInputs.length} video inputs`, {
        devices: videoInputs.map((d) => ({
          deviceId: d.deviceId ? d.deviceId.substring(0, 8) + "..." : "empty",
          label: d.label || "unlabeled",
        })),
      });
    } catch (e: any) {
      logScanner("enumerate_devices_warn", `enumerateDevices failed: ${e.message}`, {}, "warn");
    }

    const attempts: { name: string; constraints: MediaStreamConstraints }[] = [
      {
        name: "1080p_ideal_environment",
        constraints: {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        },
      },
      {
        name: "environment_generic",
        constraints: {
          video: { facingMode: "environment" },
          audio: false,
        },
      },
      {
        name: "any_video_fallback",
        constraints: {
          video: true,
          audio: false,
        },
      },
    ];

    let stream: MediaStream | null = null;
    let successfulAttempt = "";

    setCameraStage("requesting_permission");
    for (const attempt of attempts) {
      logScanner("get_user_media_attempt", `Trying constraint: ${attempt.name}`, attempt.constraints);
      try {
        // Wrap getUserMedia in a 10s timeout to detect if browser dialog is hung
        const streamPromise = navigator.mediaDevices.getUserMedia(attempt.constraints);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("getUserMedia timed out after 10 seconds")), 10000)
        );

        stream = await Promise.race([streamPromise, timeoutPromise]);
        successfulAttempt = attempt.name;
        logScanner("get_user_media_success", `Obtained stream using ${attempt.name}`, {
          tracks: stream.getVideoTracks().map((t) => ({
            label: t.label,
            readyState: t.readyState,
            settings: t.getSettings ? t.getSettings() : {},
          })),
        });
        break;
      } catch (err: any) {
        logScanner("get_user_media_failed", `Attempt ${attempt.name} failed: ${err.name} - ${err.message}`, {
          errorName: err.name,
          errorMessage: err.message,
        }, "warn");

        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionDenied(true);
          setCameraStage("permission_denied");
          const msg = "Camera permission was denied. Please allow camera access in your browser settings to scan cards.";
          logScanner("permission_denied", msg, {}, "error");
          setError(msg);
          return;
        }
      }
    }

    if (!stream) {
      const msg = "Could not access any camera. Please verify device permissions and hardware.";
      logScanner("camera_failed", msg, {}, "error");
      setError(msg);
      setCameraStage("failed");
      return;
    }

    streamRef.current = stream;
    setCameraStage("attaching_to_video");

    // Attach to video element
    const v = videoRef.current;
    if (!v) {
      logScanner("video_ref_missing", "videoRef is null when stream ready. Will retry attachment in effect", {}, "warn");
      setCameraReady(true);
      return;
    }

    try {
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      v.setAttribute("webkit-playsinline", "true");
      v.muted = true;
      v.autoplay = true;

      logScanner("video_element_play", "Calling video.play()");
      await v.play().catch((playErr) => {
        logScanner("video_play_warn", `video.play() rejected: ${playErr.name} - ${playErr.message}`, {}, "warn");
      });

      // Wait for video metadata/dimensions
      if (v.videoWidth === 0) {
        await new Promise<void>((resolve) => {
          const onMeta = () => {
            v.removeEventListener("loadedmetadata", onMeta);
            resolve();
          };
          v.addEventListener("loadedmetadata", onMeta);
          setTimeout(resolve, 1500);
        });
      }

      logScanner("video_ready", `Video stream running (${successfulAttempt})`, {
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        readyState: v.readyState,
      });

      setCameraReady(true);
      setCameraStage("ready");
      setError("");
    } catch (e: any) {
      logScanner("video_attach_error", `Error playing video: ${e.message}`, { error: e }, "error");
      setError("Failed to start video display: " + e.message);
    }
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    requestCamera().catch((e) => {
      if (!cancelled) {
        logScanner("request_camera_uncaught", e.message, { error: e }, "error");
        setError(e.message || "Failed to start camera");
      }
    });

    return () => {
      cancelled = true;
      if (streamRef.current) {
        logScanner("cleanup", "Cleaning up media stream tracks on unmount");
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
      setCameraStage("idle");
    };
  }, [enabled, requestCamera]);

  // Ensure stream stays attached to video element if element mounted late
  useEffect(() => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (cameraReady && v && s && v.srcObject !== s) {
      v.srcObject = s;
      v.play().catch(() => {});
    }
  }, [cameraReady]);

  // Pure-TS real-time frame analysis loop (~10 FPS)
  useEffect(() => {
    if (!enabled || !cameraReady) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let busy = false;

    logScanner("analysis_loop", "Starting computer vision analysis loop (pure TS)");

    const work = document.createElement("canvas");
    const wctx = work.getContext("2d", { willReadFrequently: true })!;

    const tick = () => {
      if (stop) return;
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && !capturingRef.current && !busy) {
        busy = true;
        try {
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          const guide = guideRect(vw, vh);

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

          // Fast pure-TS grayscale conversion (1ms)
          const data = imgData.data;
          const gray = new Uint8ClampedArray(aw * ah);
          for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            gray[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
          }

          // Compute guide bounds in analysis space
          const scaledGuide = {
            x: guide.x * scale,
            y: guide.y * scale,
            width: guide.width * scale,
            height: guide.height * scale,
          };
          const scaledQuad = rectToQuad(scaledGuide);

          // Pure-TS metrics calculation
          const sharpness = laplacianVariance(gray, aw, ah);
          const glare = glareRatio(gray, aw, ah, scaledQuad, config.glareLuminance);

          // Optional: if OpenCV happens to be loaded already, refine quad contour
          let detectedQuad: Quad | null = null;
          if (typeof window !== "undefined" && window.cv?.Mat) {
            try {
              const det = detectCardQuad(window.cv, imgData, guide, scale);
              if (det.quad) {
                detectedQuad = det.quad.map((p) => ({ x: p.x * det.scale, y: p.y * det.scale })) as Quad;
              }
            } catch {
              // Ignore; fallback to guide rect
            }
          }

          const next = evaluateFrame(
            { guide, quad: detectedQuad, sharpness, glare, timestamp: Date.now() },
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
            logScanner("auto_capture", "Quality gate passed, triggering auto-capture");
            void capture("auto").then((c) => c && onAutoRef.current?.(c));
            metricsRef.current = { ...next, stableFrames: 0 };
          }
        } catch (err: any) {
          logScanner("analysis_frame_error", `Frame analysis error: ${err.message}`, { error: err }, "warn");
        } finally {
          busy = false;
        }
      }

      timer = setTimeout(tick, 100);
    };

    timer = setTimeout(tick, 150);

    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [enabled, cameraReady, config, capture]);

  return {
    videoRef,
    metrics,
    error,
    cameraReady,
    cvReady,
    cameraStage,
    permissionDenied,
    requestCamera,
    capture,
    getGuide: grabGuide,
  };
}
