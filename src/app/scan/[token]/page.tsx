"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, Send, Check, Keyboard } from "lucide-react";

export default function MobileScanPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [cameraError, setCameraError] = useState("");
  const [streamActive, setStreamActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [log, setLog] = useState<{ text: string; ok: boolean }[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("This browser can't open the camera. Use manual entry below.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
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
    return () => stream?.getTracks().forEach((t) => t.stop());
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

  const send = async (detections: string[]) => {
    if (!token || detections.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/scanner/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, detections }),
      });
      const data = await res.json();
      const ok = res.ok && !!data.items;
      setLog((prev) => [...detections.map((text) => ({ text, ok })), ...prev]);
    } catch {
      setLog((prev) => [...detections.map((text) => ({ text, ok: false })), ...prev]);
    } finally {
      setSubmitting(false);
    }
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    // Recognition is simulated until on-device OCR ships.
    const sampleCodes = ["DOA 001", "ALC 042", "P24 000", "Fracturize", "Rayne, Sword of Light"];
    send([sampleCodes[Math.floor(Math.random() * sampleCodes.length)]]);
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    send([manualCode.trim()]);
    setManualCode("");
  };

  return (
    <div className="mx-auto max-w-md space-y-4 pb-8">
      <div className="flex items-center justify-between rounded-2xl glass px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold text-white">Phone Scanner</h1>
          <p className="font-mono text-[10px] text-slate-500">Session {token.slice(0, 10)}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300" role="status">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Paired
        </span>
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-black shadow-2xl">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${streamActive ? "block" : "hidden"}`} />
        {!streamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            {cameraError ? <CameraOff className="h-10 w-10 text-slate-600" /> : <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />}
            <p className="text-xs text-slate-400">{cameraError || "Starting camera..."}</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-10 inset-y-14">
          {["left-0 top-0 border-l-2 border-t-2 rounded-tl-xl", "right-0 top-0 border-r-2 border-t-2 rounded-tr-xl", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl"].map((c) => (
            <span key={c} className={`absolute h-8 w-8 border-cyan-300 ${c}`} />
          ))}
          {streamActive && <span className="scan-line absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_2px_rgba(103,232,249,0.6)]" />}
        </div>
        <p className="pointer-events-none absolute inset-x-0 top-4 text-center text-[11px] font-medium text-white/80">Align the card title or collector number</p>

        {flash && <div className="absolute inset-0 bg-white/60" />}

        <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-6">
          <span className="w-11" />
          <button
            onClick={capture}
            disabled={!streamActive || submitting}
            aria-label="Capture card"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white/10 backdrop-blur transition-transform active:scale-90 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Camera className="h-6 w-6 text-white" />}
          </button>
          {torchSupported ? (
            <button onClick={toggleTorch} aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"} aria-pressed={torchOn} className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-all ${torchOn ? "bg-amber-300 text-slate-900" : "bg-black/50 text-white"}`}>
              {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <form onSubmit={submitManual} className="rounded-2xl glass p-4">
        <label htmlFor="manual-code" className="label-caps mb-2 flex items-center gap-1.5"><Keyboard className="h-3 w-3" /> Manual Entry</label>
        <div className="flex gap-2">
          <input id="manual-code" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="DOA 001 or card name" className="input-field" />
          <button type="submit" disabled={submitting || !manualCode.trim()} className="btn-accent shrink-0 !px-3" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>

      <div className="rounded-2xl glass p-4">
        <p className="label-caps mb-2">Sent to Desktop</p>
        {log.length === 0 ? (
          <p className="text-[11px] text-slate-600">Nothing scanned yet.</p>
        ) : (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto">
            {log.map((l, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs animate-fade-in ${l.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"}`}>
                <Check className="h-3 w-3 shrink-0" /> <span className="truncate">{l.text}</span>
                {!l.ok && <span className="ml-auto text-[10px]">failed</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
