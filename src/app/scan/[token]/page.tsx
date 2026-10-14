"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  Loader2,
  Send,
  Check,
  Keyboard,
  Sparkles,
  Volume2,
  VolumeX,
  ScanLine,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LogItem {
  text: string;
  cardName?: string;
  setPrefix?: string;
  collectorNumber?: string;
  ok: boolean;
  time: string;
}

export default function MobileScanPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const tesseractWorkerRef = useRef<any>(null);

  const [cameraError, setCameraError] = useState("");
  const [streamActive, setStreamActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Auto-scan state
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [scanState, setScanState] = useState<"idle" | "sampling" | "recognized" | "cooldown">("idle");
  const [statusMessage, setStatusMessage] = useState("Align card inside frame");
  const [lastCapturedCard, setLastCapturedCard] = useState<string | null>(null);

  const [log, setLog] = useState<LogItem[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(false);
  const [ocrEngineReady, setOcrEngineReady] = useState(false);

  // Refs for auto-scan loop synchronization
  const autoScanEnabledRef = useRef(autoScanEnabled);
  autoScanEnabledRef.current = autoScanEnabled;

  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;

  const cooldownRef = useRef(false);
  const lastScannedTextRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);

  // Play audio chime on recognition
  const playCaptureChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {
      // Audio playback blocked or unsupported
    }
  }, [soundEnabled]);

  // Provide haptic feedback
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
    } catch {}
  }, []);

  // Initialize camera with high-resolution constraints
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("This browser doesn't support camera access. Use manual entry below.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
        });
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = (track?.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(!!caps.torch);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamActive(true);
        }
      } catch (err: any) {
        setCameraError(err?.message || "Camera access was denied.");
      }
    })();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Initialize OCR engine (Native TextDetector if supported, Tesseract.js worker as universal fallback)
  useEffect(() => {
    let isMounted = true;

    // Check if native TextDetector is available in this browser
    if (typeof window !== "undefined" && "TextDetector" in window) {
      setOcrEngineReady(true);
    }

    // Load Tesseract.js worker in background
    (async () => {
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        if (isMounted) {
          tesseractWorkerRef.current = worker;
          setOcrEngineReady(true);
        } else {
          await worker.terminate();
        }
      } catch (err) {
        console.warn("Could not initialize Tesseract worker:", err);
      }
    })();

    return () => {
      isMounted = false;
      if (tesseractWorkerRef.current) {
        tesseractWorkerRef.current.terminate();
      }
    };
  }, []);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      setTorchSupported(false);
    }
  };

  // Preprocess and crop a specific region of the video frame to an offscreen canvas
  const cropAndEnhance = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    crop: { x: number; y: number; w: number; h: number }
  ): boolean => {
    if (crop.w <= 0 || crop.h <= 0) return false;
    const targetW = Math.max(crop.w, 520);
    const scale = targetW / crop.w;
    canvas.width = Math.round(crop.w * scale);
    canvas.height = Math.round(crop.h * scale);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    // Draw crop scaled
    ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      // Calculate mean luminance
      let totalLuma = 0;
      const count = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        totalLuma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      const meanLuma = totalLuma / count;
      const contrast = 1.4; // 40% contrast enhancement

      // Apply contrast stretch
      for (let i = 0; i < d.length; i += 4) {
        const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        let val = meanLuma + (luma - meanLuma) * contrast;
        val = Math.max(0, Math.min(255, val));
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
      return true;
    } catch {
      return true;
    }
  };

  // Perform OCR on canvas using Native TextDetector or Tesseract.js worker
  const runOcr = async (canvas: HTMLCanvasElement): Promise<string[]> => {
    // 1. Native Shape Detection API if supported (Chrome Android)
    if (typeof window !== "undefined" && "TextDetector" in window) {
      try {
        const detector = new (window as any).TextDetector();
        const results = await detector.detect(canvas);
        if (Array.isArray(results) && results.length > 0) {
          const texts = results.map((r: any) => r.rawValue?.trim()).filter(Boolean);
          if (texts.length > 0) return texts;
        }
      } catch {}
    }

    // 2. Tesseract.js worker fallback
    if (tesseractWorkerRef.current) {
      try {
        const res = await tesseractWorkerRef.current.recognize(canvas);
        const text = res?.data?.text || "";
        return text
          .split("\n")
          .map((l: string) => l.trim())
          .filter((l: string) => l.length >= 2);
      } catch {}
    }

    return [];
  };

  // Submit detected strings to the desktop session
  const send = async (detections: string[]): Promise<{ matched: boolean; cardName?: string }> => {
    if (!token || detections.length === 0) return { matched: false };
    setSubmitting(true);
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    try {
      const res = await fetch("/api/scanner/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, detections }),
      });
      const data = await res.json();
      const items = data.items || [];
      const firstMatched = items.find((it: any) => it.editionId);

      if (firstMatched) {
        setLog((prev) => [
          {
            text: detections.join(" | "),
            cardName: firstMatched.cardName,
            setPrefix: firstMatched.setPrefix,
            collectorNumber: firstMatched.collectorNumber,
            ok: true,
            time: nowStr,
          },
          ...prev,
        ]);
        return { matched: true, cardName: firstMatched.cardName };
      } else {
        // Unrecognized or non-Grand Archive card
        setLog((prev) => [
          {
            text: detections.join(" | "),
            ok: false,
            time: nowStr,
          },
          ...prev,
        ]);
        return { matched: false };
      }
    } catch {
      setLog((prev) => [
        {
          text: detections.join(" | "),
          ok: false,
          time: nowStr,
        },
        ...prev,
      ]);
      return { matched: false };
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate card framing coordinates on video
  const getCardBoxes = (video: HTMLVideoElement) => {
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    // Card aspect ratio: 2.5 / 3.5 = 0.714
    let cardW = vw * 0.75;
    let cardH = cardW / 0.714;
    if (cardH > vh * 0.85) {
      cardH = vh * 0.85;
      cardW = cardH * 0.714;
    }
    const startX = (vw - cardW) / 2;
    const startY = (vh - cardH) / 2;

    return {
      full: { x: startX, y: startY, w: cardW, h: cardH },
      title: {
        x: startX + cardW * 0.04,
        y: startY + cardH * 0.02,
        w: cardW * 0.92,
        h: cardH * 0.20,
      },
      footer: {
        x: startX + cardW * 0.04,
        y: startY + cardH * 0.82,
        w: cardW * 0.92,
        h: cardH * 0.16,
      },
    };
  };

  // Manual capture function (shutter button)
  const captureManual = async () => {
    if (!videoRef.current || !canvasRef.current || submitting) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    const boxes = getCardBoxes(video);

    // 1. Check footer crop first (collector number)
    cropAndEnhance(video, canvas, boxes.footer);
    let texts = await runOcr(canvas);

    // 2. Check title crop (card name)
    if (texts.length === 0) {
      cropAndEnhance(video, canvas, boxes.title);
      texts = await runOcr(canvas);
    }

    // 3. Fallback to full card
    if (texts.length === 0) {
      cropAndEnhance(video, canvas, boxes.full);
      texts = await runOcr(canvas);
    }

    if (texts.length === 0) {
      setStatusMessage("No readable text detected in frame");
      return;
    }

    setStatusMessage(`Scanned: "${texts[0]}"`);
    const result = await send(texts);
    if (result.matched) {
      playCaptureChime();
      triggerHaptic();
      setScanState("recognized");
      setLastCapturedCard(result.cardName || texts[0]);
      setStatusMessage(`✓ Added: ${result.cardName || texts[0]}`);
      setTimeout(() => setScanState("idle"), 2000);
    } else {
      setStatusMessage(`"${texts[0]}" — Not found in catalog`);
    }
  };

  // Continuous auto-capture sampling loop
  useEffect(() => {
    if (!streamActive) return;

    const interval = setInterval(async () => {
      if (!autoScanEnabledRef.current || submittingRef.current || cooldownRef.current) {
        return;
      }
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2) return;

      const boxes = getCardBoxes(video);

      // Check footer region first (collector code)
      cropAndEnhance(video, canvas, boxes.footer);
      let candidates = await runOcr(canvas);

      // Regex for Grand Archive collector codes e.g. "DOA 001", "DOA 1st 001", "ALC 042", "P24 000"
      const codePattern = /(?:^|\b)([A-Za-z0-9]{2,6})(?:[\s\-_]+(1st|alter|sd|dp|evp|p))?[\s\-_#]+(\d{3})(?:\b|$)/i;
      const codeCandidate = candidates.find((t) => codePattern.test(t));

      let textsToSubmit: string[] = [];
      if (codeCandidate) {
        textsToSubmit = [codeCandidate];
      } else {
        // If no collector code, sample title region
        cropAndEnhance(video, canvas, boxes.title);
        const titleCandidates = await runOcr(canvas);
        const cleanTitle = titleCandidates.find((t) => t.length >= 4 && /[A-Za-z]/.test(t));
        if (cleanTitle) {
          textsToSubmit = [cleanTitle];
        }
      }

      if (textsToSubmit.length === 0) {
        return;
      }

      const raw = textsToSubmit[0].trim();
      // Skip if this exact text was scanned in the last 4 seconds
      const now = Date.now();
      if (raw === lastScannedTextRef.current && now - lastScannedTimeRef.current < 4000) {
        return;
      }

      setScanState("sampling");
      setStatusMessage(`Checking: ${raw}...`);

      const result = await send(textsToSubmit);

      if (result.matched) {
        // Card recognized in frame! Trigger auto-capture effects
        lastScannedTextRef.current = raw;
        lastScannedTimeRef.current = now;

        playCaptureChime();
        triggerHaptic();
        setFlash(true);
        setTimeout(() => setFlash(false), 200);

        setScanState("recognized");
        setLastCapturedCard(result.cardName || raw);
        setStatusMessage(`✓ Auto-captured: ${result.cardName || raw}`);

        // Enter cooldown so user has time to position next card
        cooldownRef.current = true;
        setTimeout(() => {
          cooldownRef.current = false;
          setScanState("idle");
          setStatusMessage("Ready for next card");
        }, 2500);
      } else {
        // Unrecognized card (e.g. Two of Diamonds) - don't auto-capture!
        setScanState("idle");
        setStatusMessage("Align card inside frame");
      }
    }, 450);

    return () => clearInterval(interval);
  }, [streamActive, playCaptureChime, triggerHaptic]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    send([manualCode.trim()]);
    setManualCode("");
  };

  return (
    <div className="mx-auto max-w-md space-y-4 pb-8">
      {/* Top Header Card */}
      <div className="flex items-center justify-between rounded-2xl glass px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold text-white">Phone Scanner</h1>
          <p className="font-mono text-[10px] text-slate-500">Session {token.slice(0, 10)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            aria-label={soundEnabled ? "Mute audio" : "Enable audio"}
            className="rounded-full p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-slate-600" />}
          </button>

          {/* Connection status */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300"
            role="status"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Paired
          </span>
        </div>
      </div>

      {/* Auto-Scan Mode Banner */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className={`h-4 w-4 ${autoScanEnabled ? "text-cyan-400" : "text-slate-500"}`} />
          <span className="text-xs font-medium text-slate-200">
            {autoScanEnabled ? "Auto-Capture ON" : "Manual Mode"}
          </span>
        </div>
        <button
          onClick={() => {
            setAutoScanEnabled((v) => !v);
            setStatusMessage(!autoScanEnabled ? "Auto-scan active: Align card in frame" : "Manual mode: Tap camera button to capture");
          }}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
            autoScanEnabled
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
              : "bg-white/10 text-slate-400 border border-white/10"
          }`}
        >
          {autoScanEnabled ? "Switch to Manual" : "Enable Auto-Scan"}
        </button>
      </div>

      {/* Camera Viewfinder Box */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-black shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${streamActive ? "block" : "hidden"}`}
        />

        {!streamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            {cameraError ? (
              <CameraOff className="h-10 w-10 text-slate-600" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            )}
            <p className="text-xs text-slate-400">{cameraError || "Starting camera..."}</p>
          </div>
        )}

        {/* Framing Guide Reticle */}
        <div
          className={`pointer-events-none absolute inset-x-8 inset-y-12 rounded-2xl transition-all duration-300 ${
            scanState === "recognized"
              ? "border-2 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)]"
              : scanState === "sampling"
              ? "border border-amber-300/60 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
              : "border border-white/20"
          }`}
        >
          {/* Corner brackets */}
          {["left-0 top-0 border-l-2 border-t-2 rounded-tl-xl",
            "right-0 top-0 border-r-2 border-t-2 rounded-tr-xl",
            "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
            "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
          ].map((c) => (
            <span
              key={c}
              className={`absolute h-8 w-8 transition-colors duration-200 ${c} ${
                scanState === "recognized"
                  ? "border-emerald-300"
                  : scanState === "sampling"
                  ? "border-amber-300"
                  : "border-cyan-300"
              }`}
            />
          ))}

          {/* Top Title Crop Guide */}
          <div className="absolute inset-x-2 top-2 h-10 rounded border border-dashed border-white/20 flex items-center justify-center">
            <span className="text-[9px] uppercase tracking-wider text-white/50 font-mono">Title Zone</span>
          </div>

          {/* Bottom Code Crop Guide */}
          <div className="absolute inset-x-2 bottom-2 h-9 rounded border border-dashed border-white/20 flex items-center justify-center">
            <span className="text-[9px] uppercase tracking-wider text-white/50 font-mono">Code Zone (DOA 001)</span>
          </div>

          {/* Moving scan-line */}
          {streamActive && scanState !== "recognized" && (
            <span className="scan-line absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_2px_rgba(103,232,249,0.6)]" />
          )}
        </div>

        {/* Live Status Pill */}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-center">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium backdrop-blur-md transition-all duration-300 ${
              scanState === "recognized"
                ? "bg-emerald-500/80 text-white shadow-lg shadow-emerald-500/30"
                : scanState === "sampling"
                ? "bg-amber-500/80 text-slate-900"
                : "bg-black/60 text-white/90 border border-white/10"
            }`}
          >
            {scanState === "sampling" && <Loader2 className="h-3 w-3 animate-spin" />}
            {scanState === "recognized" && <Check className="h-3.5 w-3.5" />}
            <span>{statusMessage}</span>
          </div>
        </div>

        {/* Camera Flash overlay */}
        {flash && <div className="absolute inset-0 bg-white/70 transition-opacity duration-200" />}

        {/* Bottom controls */}
        <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-6">
          <span className="w-11" />

          {/* Big Shutter button */}
          <button
            onClick={captureManual}
            disabled={!streamActive || submitting}
            aria-label="Capture card manually"
            className={`flex h-16 w-16 items-center justify-center rounded-full border-4 backdrop-blur transition-all active:scale-90 disabled:opacity-40 ${
              scanState === "recognized"
                ? "border-emerald-300 bg-emerald-500/20"
                : "border-white/80 bg-white/10"
            }`}
          >
            {submitting ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </button>

          {/* Torch toggle */}
          {torchSupported ? (
            <button
              onClick={toggleTorch}
              aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
              aria-pressed={torchOn}
              className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-all ${
                torchOn ? "bg-amber-300 text-slate-900" : "bg-black/50 text-white"
              }`}
            >
              {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>

        {/* Hidden Canvas for OCR processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Manual Entry Form */}
      <form onSubmit={submitManual} className="rounded-2xl glass p-4">
        <label htmlFor="manual-code" className="label-caps mb-2 flex items-center gap-1.5">
          <Keyboard className="h-3 w-3" /> Manual Entry
        </label>
        <div className="flex gap-2">
          <Input
            id="manual-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="DOA 001, ALC 042, or card name"
          />
          <Button
            type="submit"
            disabled={submitting || !manualCode.trim()}
            variant="accent"
            className="shrink-0 px-3"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Sent to Desktop Live Log */}
      <div className="rounded-2xl glass p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="label-caps">Sent to Desktop</p>
          <span className="text-[10px] font-mono text-slate-500">{log.length} scanned</span>
        </div>

        {log.length === 0 ? (
          <p className="text-[11px] text-slate-600">Nothing scanned yet. Point your camera at a card.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {log.map((l, i) => (
              <li
                key={i}
                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs animate-fade-in ${
                  l.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  {l.ok ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  )}
                  <span className="font-medium truncate">{l.cardName || l.text}</span>
                  {l.setPrefix && (
                    <span className="font-mono text-[10px] text-slate-400">
                      {l.setPrefix} #{l.collectorNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400">
                  <span>{l.time}</span>
                  {!l.ok && <span className="text-rose-400 font-medium">unrecognized</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
