"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CardMatchResult, CardVariant } from "@/lib/scanner/contracts";
import { VariantSelector } from "./VariantSelector";

interface Props {
  candidates: CardMatchResult[];
  onSelect: (c: CardMatchResult, variant: CardVariant) => void;
  onRetake: () => void;
}

const badgeClass = (pct: number) =>
  pct >= 90 ? "bg-emerald-500/20 text-emerald-300" : pct >= 70 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300";

/** Top-5 candidates with certainty badges; selecting one reveals the variant toggle and Add button. */
export function CandidateList({ candidates, onSelect, onRetake }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [variant, setVariant] = useState<CardVariant>("normal");

  if (candidates.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-xl bg-slate-900 p-4 text-center text-sm text-slate-300">
        <p>No match found. Try again with better lighting.</p>
        <Button onClick={onRetake}>Retake</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-2">
      {candidates.map((c) => {
        const active = selected === c.editionId;
        return (
          <div
            key={c.editionId}
            className={`rounded-xl border bg-slate-900 p-2 ${active ? "border-cyan-400/50" : "border-white/[0.08]"}`}
          >
            <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setSelected(c.editionId)}>
              <img src={c.imageUrl} alt={c.cardName} className="h-16 w-12 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">{c.cardName}</div>
                <div className="text-xs text-slate-400">
                  {c.setPrefix} #{c.collectorNumber}
                  {c.signals.ocrFallback && <span className="ml-2 text-amber-300">Verify set</span>}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(c.confidence)}`}>
                {Math.round(c.confidence)}%
              </span>
            </button>
            {active && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <VariantSelector value={variant} onChange={setVariant} />
                <Button onClick={() => onSelect(c, variant)}>Add to binder</Button>
              </div>
            )}
          </div>
        );
      })}
      <Button variant="ghost" className="w-full" onClick={onRetake}>
        Retake
      </Button>
    </div>
  );
}
