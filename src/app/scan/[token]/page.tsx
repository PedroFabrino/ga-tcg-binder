"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CameraOverlay } from "@/components/scanner/CameraOverlay";
import { CandidateList } from "@/components/scanner/CandidateList";
import { RapidScanDrawer, type QueuedScan } from "@/components/scanner/RapidScanDrawer";
import type { CardMatchResult, CardVariant } from "@/lib/scanner/contracts";
import { extractFeatures } from "@/lib/scanner/extract";
import type { NormalizedCapture } from "@/lib/scanner/warp";

const RAPID_THRESHOLD = 90;
const AUTO_COOLDOWN_MS = 2500;

async function postJson(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/** Mobile paired scanner: no login, results sync to the desktop session via the token. */
export default function MobileScanPage() {
  const token = (useParams()?.token as string) || "";
  const [rapid, setRapid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<CardMatchResult[] | null>(null);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const busyRef = useRef(false);
  const cooldownUntil = useRef(0);

  const enqueue = useCallback(
    async (candidate: CardMatchResult, variant: CardVariant) => {
      const { item } = await postJson("/api/scanner/queue", "POST", {
        token,
        editionId: candidate.editionId,
        foil: variant === "foil",
        confidence: candidate.confidence,
      });
      setQueue((q) => [...q, { key: item.timestamp, candidate, variant }]);
    },
    [token]
  );

  const handleCapture = useCallback(
    async (capture: NormalizedCapture) => {
      if (busyRef.current) return;
      if (capture.source === "auto" && Date.now() < cooldownUntil.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      try {
        const payload = await extractFeatures(capture.canvas, capture.blob, capture.source);
        const { candidates: found } = await postJson("/api/scanner/identify", "POST", {
          token,
          phash: payload.phash,
          headerText: payload.ocr.headerText,
          footerText: payload.ocr.footerText,
        });
        const top: CardMatchResult | undefined = found[0];
        if (rapid && top && top.confidence >= RAPID_THRESHOLD) {
          await enqueue(top, "normal");
        } else {
          setCandidates(found);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        cooldownUntil.current = Date.now() + AUTO_COOLDOWN_MS;
        busyRef.current = false;
        setBusy(false);
      }
    },
    [token, rapid, enqueue]
  );

  const select = async (c: CardMatchResult, variant: CardVariant) => {
    try {
      await enqueue(c, variant);
      setCandidates(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const undo = async (key: number) => {
    await postJson("/api/scanner/queue", "PATCH", { token, timestamp: key, remove: true }).catch((e) => setError(e.message));
    setQueue((q) => q.filter((i) => i.key !== key));
  };

  const changeVariant = async (key: number, variant: CardVariant) => {
    await postJson("/api/scanner/queue", "PATCH", { token, timestamp: key, foil: variant === "foil" }).catch((e) =>
      setError(e.message)
    );
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, variant } : i)));
  };

  return (
    <main className="min-h-screen bg-slate-950 p-3 pb-40 text-slate-200">
      <div className="mx-auto flex max-w-md items-center justify-between py-2">
        <h1 className="text-base font-semibold">Card Scanner</h1>
        <label className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-amber-300" /> Rapid scan
          <Switch checked={rapid} onCheckedChange={setRapid} />
        </label>
      </div>

      {candidates ? (
        <CandidateList candidates={candidates} onSelect={select} onRetake={() => setCandidates(null)} />
      ) : (
        <CameraOverlay onCapture={handleCapture} />
      )}

      {busy && (
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Identifying…
        </p>
      )}
      {error && <p className="mt-3 text-center text-sm text-rose-400">{error}</p>}

      <RapidScanDrawer items={queue} onUndo={undo} onChangeVariant={changeVariant} />
    </main>
  );
}
