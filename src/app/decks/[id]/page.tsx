"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Trash2, Crown, BookOpen, Check } from "lucide-react";
import { ConfirmModal } from "@/components/common";
import { SkeletonRow, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import ShortageTable, { FeasibilityBanner, type ShortageItem, type ShortageReport } from "@/components/decks/ShortageTable";
import DeckList, { type DeckCard } from "@/components/decks/DeckList";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function DeckDetailPage() {
  const params = useParams();
  const deckId = params?.id as string;
  const { showToast } = useToast();

  const [deck, setDeck] = useState<any>(null);
  const [cards, setCards] = useState<{ material: DeckCard[]; main: DeckCard[]; side: DeckCard[] }>({ material: [], main: [], side: [] });
  const [omnidexText, setOmnidexText] = useState("");
  const [shortage, setShortage] = useState<ShortageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [deckRes, shortageRes] = await Promise.all([fetch(`/api/decks/${deckId}`), fetch(`/api/decks/${deckId}/shortage`)]);
      if (deckRes.status === 404) {
        setNotFound(true);
        return;
      }
      const deckData = await deckRes.json();
      const shortageData = shortageRes.ok ? await shortageRes.json() : null;
      if (deckData.deck) {
        setDeck(deckData.deck);
        setCards({
          material: deckData.cards?.material || [],
          main: deckData.cards?.main || [],
          side: deckData.cards?.side || [],
        });
        setOmnidexText(deckData.omnidexText || "");
      }
      if (Array.isArray(shortageData?.items)) setShortage(shortageData);
    } catch {
      showToast("Couldn't load this deck", "error");
    } finally {
      setLoading(false);
    }
  }, [deckId, showToast]);

  useEffect(() => {
    if (deckId) load();
  }, [deckId, load]);

  const copyOmnidex = async () => {
    try {
      await navigator.clipboard.writeText(omnidexText);
      setCopied(true);
      showToast("Omnidex decklist copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not access clipboard", "error");
    }
  };

  const addMissing = async (item: ShortageItem) => {
    setAddingSlug(item.cardSlug);
    try {
      const catRes = await fetch(`/api/catalog?query=${encodeURIComponent(item.cardSlug)}&limit=1`);
      const catData = catRes.ok ? await catRes.json() : null;
      const edition = catData?.cards?.[0]?.editions?.[0];
      if (!edition) throw new Error("No printing found");
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: edition.id, foil: false, quantity: item.missingQuantity }),
      });
      if (!res.ok) throw new Error();
      showToast(`Added ${item.missingQuantity}x ${item.cardName} to Binder`, "success");
      load(true);
    } catch {
      showToast(`Couldn't add ${item.cardName}`, "error");
    } finally {
      setAddingSlug(null);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${deck?.name}"`, "info");
      window.location.href = "/decks";
    } catch {
      showToast("Couldn't delete deck", "error");
      setDeleting(false);
    }
  };

  if (notFound) {
    return <EmptyState icon={BookOpen} title="Deck not found" description="It may have been deleted." action={<Button asChild variant="outline"><a href="/decks">Back to Decks</a></Button>} />;
  }

  return (
    <div className="space-y-6 pb-12">
      <a href="/decks" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All Decks
      </a>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-200/15 to-transparent text-amber-200 shadow-[0_0_30px_-10px_rgba(232,201,103,0.5)]">
            <Crown className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            {deck ? (
              <>
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">{deck.format}</span>
                </div>
                <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">{deck.name}</h1>
                <p className="text-sm text-slate-400">{deck.champion || "No champion set"}</p>
              </>
            ) : (
              <div className="space-y-2"><div className="skeleton h-7 w-56 rounded" /><div className="skeleton h-4 w-32 rounded" /></div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={copyOmnidex} disabled={!omnidexText} variant="outline">
            {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />} Export Omnidex
          </Button>
          <Button onClick={() => setConfirmDelete(true)} disabled={!deck} variant="outline" className="hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300" aria-label="Delete deck">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-2xl" />
          <div className="divide-y divide-white/[0.04] rounded-2xl glass">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i}/>)}</div>
        </div>
      ) : (
        <>
          {shortage && <FeasibilityBanner report={shortage}/>}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="rounded-2xl glass p-5 lg:col-span-2" aria-label="Demand and contention">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Demand & Contention</h2>
                  <p className="text-[11px] text-slate-500">Shared copies may fill several decks; dedicated copies stay with one.</p>
                </div>
                <label htmlFor="only-missing" className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <Switch id="only-missing" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
                  Only show shortages
                </label>
              </div>
              <ShortageTable items={shortage?.items || []} onAddMissing={addMissing} addingSlug={addingSlug} onlyMissing={onlyMissing}/>
            </section>
            <aside className="rounded-2xl glass p-5" aria-label="Decklist">
              <DeckList {...cards}/>
            </aside>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete deck?"
          message={`"${deck?.name}" will be removed. Cards in your binder are not affected.`}
          confirmLabel="Delete Deck"
          busy={deleting}
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
