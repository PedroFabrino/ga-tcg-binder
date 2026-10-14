"use client";

import { Sparkles } from "lucide-react";
import type { CardVariant } from "@/lib/scanner/contracts";

const OPTIONS: { value: CardVariant; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "foil", label: "Foil" },
];

/** One-tap Normal / Foil toggle. */
export function VariantSelector({ value, onChange }: { value: CardVariant; onChange: (v: CardVariant) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.08] p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === o.value ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400"
          }`}
        >
          {o.value === "foil" && <Sparkles className="h-3.5 w-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
