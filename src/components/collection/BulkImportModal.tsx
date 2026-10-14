"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui";

interface ParsedLine {
  raw: string;
  qty?: number;
  name?: string;
  set?: string;
  foil?: boolean;
  error?: string;
}

function parseLine(raw: string): ParsedLine | null {
  let line = raw.trim();
  if (!line || line.startsWith("#") || line.startsWith("//")) return null;
  const m = line.match(/^(\d+)[xX]?\s+(.+)$/);
  if (!m) return { raw, error: "Missing quantity" };
  let name = m[2].trim();
  let foil = false;
  if (/\bnon-?foil\b/i.test(name)) name = name.replace(/\bnon-?foil\b/gi, "").trim();
  else if (/\bfoil\b/i.test(name)) {
    foil = true;
    name = name.replace(/\bfoil\b/gi, "").trim();
  }
  let set: string | undefined;
  const b = name.match(/[\(\[]([A-Za-z0-9\s\-]+)[\)\]]$/);
  if (b) {
    set = b[1].trim();
    name = name.replace(/[\(\[][A-Za-z0-9\s\-]+[\)\]]$/, "").trim();
  }
  return { raw, qty: parseInt(m[1], 10), name, set, foil };
}

export default function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ addedCount: number; errors: string[] } | null>(null);

  const parsed = useMemo(() => text.split(/\r?\n/).map(parseLine).filter(Boolean) as ParsedLine[], [text]);
  const valid = parsed.filter((p) => !p.error);
  const totalCopies = valid.reduce((s, p) => s + (p.qty || 0), 0);

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/collection/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");
      const r = { addedCount: data.addedCount || 0, errors: Array.isArray(data.errors) ? data.errors : [] };
      setResult(r);
      onImported(r.addedCount);
      if (r.errors.length === 0) setText("");
    } catch (err: any) {
      setResult({ addedCount: 0, errors: [err.message || "Import failed"] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      title="Bulk Text Importer"
      subtitle="Paste one card per line. Quantity, set code and foil tags are recognised."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Close</button>
          <button onClick={handleImport} disabled={importing || valid.length === 0} className="btn-primary">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {importing ? "Importing..." : `Import ${totalCopies} ${totalCopies === 1 ? "copy" : "copies"}`}
          </button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="bulk-text" className="label-caps mb-2 block">Raw Text</label>
          <textarea
            id="bulk-text"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"4x Fracturize [DOA]\n2 Rayne, Sword of Light\n1 Beseech the Winds Foil"}
            className="input-field resize-none font-mono text-xs leading-relaxed"
          />
        </div>
        <div>
          <p className="label-caps mb-2">Parse Preview</p>
          <div className="h-[262px] overflow-y-auto rounded-lg border border-white/[0.06] bg-black/20">
            {parsed.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">Lines you paste will be previewed here.</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {parsed.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-xs animate-fade-in">
                    {p.error ? (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="truncate text-slate-400">{p.raw}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-amber-300">{p.error}</span>
                      </>
                    ) : (
                      <>
                        <span className="w-8 shrink-0 font-mono font-semibold text-emerald-300">+{p.qty}</span>
                        <span className="truncate text-white">{p.name}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          {p.set && <span className="rounded border border-white/[0.08] px-1.5 font-mono text-[10px] text-slate-300">{p.set}</span>}
                          {p.foil && <Sparkles className="h-3 w-3 text-cyan-300" aria-label="Foil" />}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {result && (
        <div className={`mt-5 rounded-xl border p-4 text-xs animate-fade-in ${result.errors.length ? "border-amber-400/20 bg-amber-500/[0.06] text-amber-200" : "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-200"}`}>
          <p className="font-semibold">Added {result.addedCount} physical {result.addedCount === 1 ? "copy" : "copies"} to your binder.</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-amber-300/90">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
