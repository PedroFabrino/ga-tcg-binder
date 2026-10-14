"use client";

import { RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CardMatchResult, CardVariant } from "@/lib/scanner/contracts";

export interface QueuedScan {
  key: number;
  candidate: CardMatchResult;
  variant: CardVariant;
}

interface Props {
  items: QueuedScan[];
  onUndo: (key: number) => void;
  onChangeVariant: (key: number, v: CardVariant) => void;
}

const MAX_VISIBLE = 6;

/** Bottom drawer of recently queued scans (newest first) with Undo / Change Variant actions. */
export function RapidScanDrawer({ items, onUndo, onChangeVariant }: Props) {
  if (items.length === 0) return null;
  const recent = [...items].reverse().slice(0, MAX_VISIBLE);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-slate-900 px-4 py-3">
      <h3 className="mb-2 text-sm font-medium text-slate-200">Queued: {items.length}</h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {recent.map(({ key, candidate, variant }) => (
          <div
            key={key}
            className="flex w-56 shrink-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-slate-800 p-2"
          >
            <img src={candidate.imageUrl} alt={candidate.cardName} className="h-14 w-10 rounded object-cover" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-slate-200">{candidate.cardName}</span>
              <span className="text-xs text-cyan-400">{Math.round(candidate.confidence)}%</span>
              <div className="mt-1 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChangeVariant(key, variant === "normal" ? "foil" : "normal")}
                  className="flex items-center gap-1 px-1 text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  {variant === "normal" ? "Normal" : "Foil"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onUndo(key)} className="flex items-center gap-1 px-1 text-xs">
                  <Undo2 className="h-3 w-3" /> Undo
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
