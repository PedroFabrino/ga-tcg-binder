"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";

export default function MobileScanPage() {
  const params = useParams();
  const token = params?.token as string;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [streamActive, setStreamActive] = useState(false);
  const [detectedLog, setDetectedLog] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setHasCamera(false);
        setCameraError("Camera API not supported in this browser environment.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setStreamActive(true);
          setHasCamera(true);
        }
      } catch (err: any) {
        console.warn("Camera start failed, falling back to manual/frame input:", err);
        setHasCamera(false);
        setCameraError(err.message || "Camera access denied or unavailable.");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const sendDetections = async (detections: string[]) => {
    if (!token || detections.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/scanner/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          detections,
        }),
      });
      const data = await res.json();
      if (data.items) {
        setDetectedLog((prev) => [
          ...detections.map((d) => `Streamed: "${d}" to desktop session`),
          ...prev,
        ]);
      }
    } catch (err: any) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCaptureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Simulated client-side frame detection
      const sampleCodes = ["DOA 001", "ALC 042", "P24 000", "Fracturize", "Rayne, Sword of Light"];
      const detected = sampleCodes[Math.floor(Math.random() * sampleCodes.length)];
      sendDetections([detected]);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    sendDetections([manualCode.trim()]);
    setManualCode("");
  };

  return (
    <div className="max-w-md mx-auto space-y-5 pb-8">
      {/* Mobile Top Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Mobile Camera Scanner</h1>
            <p className="text-[10px] text-slate-400 font-mono">Paired Session: {token.substring(0, 14)}...</p>
          </div>
        </div>

        <span className="flex items-center space-x-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Bridge</span>
        </span>
      </div>

      {/* Camera Viewfinder */}
      <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-slate-950 flex flex-col items-center justify-center shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${streamActive ? "block" : "hidden"}`}
        />

        {!streamActive && (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Camera className="h-12 w-12 text-slate-600 animate-pulse" />
            <div className="text-xs text-slate-400">
              {cameraError || "Camera starting or simulated in preview mode..."}
            </div>
            <p className="text-[11px] text-slate-500">
              Point your camera at card titles or collector codes at the bottom-left of cards.
            </p>
          </div>
        )}

        {/* Viewfinder Target Reticle */}
        <div className="absolute inset-8 border border-white/20 rounded-xl pointer-events-none flex flex-col justify-between p-3">
          <div className="flex justify-between">
            <div className="w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
            <div className="w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
          </div>
          <div className="text-center">
            <span className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-indigo-300 font-medium border border-indigo-500/30">
              Align Card Title or Collector Code
            </span>
          </div>
          <div className="flex justify-between">
            <div className="w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
            <div className="w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
          </div>
        </div>

        {/* Capture Frame Action */}
        <button
          onClick={handleCaptureFrame}
          className="absolute bottom-4 rounded-full bg-indigo-600/90 backdrop-blur-md p-4 text-white shadow-xl hover:bg-indigo-500 transition-all border border-indigo-400/30 active:scale-95"
          title="Sample Frame & Detect"
        >
          <Camera className="h-6 w-6" />
        </button>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Manual / Quick Code Dispatch */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          Card OCR Code Dispatch
        </span>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. DOA 001, Fracturize..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting || !manualCode.trim()}
            className="flex items-center space-x-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>Stream</span>
          </button>
        </form>
      </div>

      {/* Streamed Log */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Streamed to Desktop Log
        </span>
        <div className="space-y-1 max-h-36 overflow-y-auto text-xs font-mono">
          {detectedLog.length === 0 ? (
            <p className="text-slate-600 text-[11px]">No cards detected yet.</p>
          ) : (
            detectedLog.map((log, idx) => (
              <div key={idx} className="text-emerald-400 bg-emerald-950/20 p-1.5 rounded border border-emerald-500/20 text-[11px]">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
