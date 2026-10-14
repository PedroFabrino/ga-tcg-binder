"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Upload, ArrowRight, CheckCircle2, AlertTriangle, Trash2, Crown } from "lucide-react";
import { PageHeader, ConfirmModal } from "@/components/common";
import { SkeletonCard, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import DeckFormModal from "@/components/decks/DeckFormModal";
import { Button } from "@/components/ui/button";

interface DeckSummary {
  id: string;
  name: string;
  champion: string;
  format: string;
  mainCount: number;
  materialCount: number;
  sideCount: number;
  totalCards: number;
}

export default function DecksPage() {
  const { showToast } = useToast();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [shortages, setShortages] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "import" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDecks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decks");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: DeckSummary[] = Array.isArray(data.decks) ? data.decks : [];
      setDecks(list);
      setError(false);
      list.forEach(async (d) => {
        try {
          const r = await fetch(`/api/decks/${d.id}/shortage`);
          const s = r.ok ? await r.json() : null;
          setShortages((prev) => ({ ...prev, [d.id]: typeof s?.totalCardsMissing === "number" ? s.totalCardsMissing : null }));
        } catch {
          setShortages((prev) => ({ ...prev, [d.id]: null }));
        }
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${pendingDelete.name}"`, "info");
      setPendingDelete(null);
      fetchDecks();
    } catch {
      showToast("Couldn't delete deck", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Decks & Shortage Engine"
        title="My Decks"
        description="Every constructed list, checked live against your binder with shared and dedicated copy rules."
        actions={
          <>
            <Button onClick={() => setFormMode("import")} variant="outline"><Upload className="h-4 w-4" /> Import Omnidex</Button>
            <Button onClick={() => setFormMode("create")} ><Plus className="h-4 w-4" /> New Deck</Button>
          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i}/>)}
        </div>
      ) : error ? (
        <EmptyState icon={BookOpen} title="We couldn't load your decks" action={<Button onClick={fetchDecks} variant="outline">Retry</Button>} />
      ) : decks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No decks yet"
          description="Create an empty deck or paste an Omnidex list to see what you're missing."
          action={<Button onClick={() => setFormMode("import")} ><Upload className="h-4 w-4" /> Import a Decklist</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, i) => {
            const missing = shortages[deck.id];
            return (
              <a
                key={deck.id}
                href={`/decks/${deck.id}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className="group relative flex flex-col overflow-hidden rounded-2xl glass p-5 hover-lift animate-fade-in hover:border-white/[0.12]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/[0.06] blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-200/10 to-transparent text-amber-200">
                      <Crown className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-white">{deck.name}</h3>
                      <p className="truncate text-xs text-slate-400">{deck.champion || "No champion set"}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete(deck); }}
                    className="rounded-lg p-1.5 text-slate-500 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Delete ${deck.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">{deck.format}</span>
                  {missing === undefined ? (
                    <span className="skeleton h-5 w-20 rounded-full" />
                  ) : missing === null ? null : missing === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                      <AlertTriangle className="h-3 w-3" /> Shortage: {missing} card{missing === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Main", value: deck.mainCount, max: 60 },
                    { label: "Material", value: deck.materialCount, max: 12 },
                    { label: "Side", value: deck.sideCount },
                  ].map((z) => (
                    <div key={z.label} className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-2 text-center">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{z.label}</div>
                      <div className="font-mono text-sm font-semibold text-white">
                        {z.value}{z.max && <span className="text-slate-500">/{z.max}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs font-medium text-slate-400 transition-colors group-hover:text-white">
                  Open shortage analysis
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </a>
            );
          })}
        </div>
      )}

      {formMode && (
        <DeckFormModal
          mode={formMode}
          onClose={() => setFormMode(null)}
          onCreated={(id, name) => {
            setFormMode(null);
            showToast(`Deck "${name}" saved`, "success");
            window.location.href = `/decks/${id}`;
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete deck?"
          message={`"${pendingDelete.name}" and its card list will be removed. Cards in your binder are not affected.`}
          confirmLabel="Delete Deck"
          busy={deleting}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
