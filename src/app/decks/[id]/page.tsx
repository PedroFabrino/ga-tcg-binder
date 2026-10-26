"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Copy, Trash2, Crown, BookOpen, Check, LayoutGrid, List, Pencil } from "lucide-react";
import { ConfirmModal } from "@/components/common";
import { SkeletonRow, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import DeckFormModal from "@/components/decks/DeckFormModal";
import ShortageTable, { FeasibilityBanner, type ShortageReport, type ShortageItem } from "@/components/decks/ShortageTable";
import DeckList, { type DeckCard } from "@/components/decks/DeckList";
import DeckCardGrid from "@/components/decks/DeckCardGrid";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { buildCollectionUpdateRequest } from "@/lib/collection-stepper";
import { useTranslation } from "@/lib/i18n";

interface BinderTarget {
  cardSlug: string;
  cardName?: string | null;
  assignedEditionId?: string | null;
}

export default function DeckDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const deckId = params?.id as string;
  const { data: session } = useSession();
  const { showToast } = useToast();

  const [deck, setDeck] = useState<any>(null);
  const [cards, setCards] = useState<{ material: DeckCard[]; main: DeckCard[]; side: DeckCard[] }>({
    material: [],
    main: [],
    side: [],
  });
  const [omnidexText, setOmnidexText] = useState("");
  const [shortage, setShortage] = useState<ShortageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userIdQuery = session?.user?.id ? `?userId=${encodeURIComponent(session.user.id)}` : "";
      const [deckRes, shortageRes] = await Promise.all([
        fetch(`/api/decks/${deckId}`),
        fetch(`/api/decks/${deckId}/shortage${userIdQuery}`),
      ]);
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
      showToast(t("decks.loadError"), "error");
    } finally {
      setLoading(false);
    }
  }, [deckId, session?.user?.id, showToast, t]);

  useEffect(() => {
    if (deckId) load();
  }, [deckId, load]);

  const copyOmnidex = async () => {
    try {
      await navigator.clipboard.writeText(omnidexText);
      setCopied(true);
      showToast(t("decks.copied"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("friends.clipboardError"), "error");
    }
  };

  const resolveEdition = async (cardSlug: string, assignedEditionId?: string | null) => {
    if (assignedEditionId) {
      return { editionId: assignedEditionId, cardName: null as string | null };
    }

    const catRes = await fetch(`/api/catalog?query=${encodeURIComponent(cardSlug)}&limit=1`);
    const catData = catRes.ok ? await catRes.json() : null;
    const foundCard = catData?.cards?.[0];
    return {
      editionId: (foundCard?.editions?.[0]?.id as string | undefined) ?? null,
      cardName: (foundCard?.name as string | undefined) ?? null,
    };
  };

  const adjustCopies = async (target: BinderTarget, delta: number, ownedQuantity: number) => {
    if (delta === 0) return;

    setAddingSlug(target.cardSlug);
    try {
      const resolved = await resolveEdition(target.cardSlug, target.assignedEditionId);
      if (!resolved.editionId) {
        throw new Error(t("shortages.noPrintingFound"));
      }

      const body = buildCollectionUpdateRequest(resolved.editionId, ownedQuantity, delta);
      if (!body) return;

      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, userId: session?.user?.id }),
      });
      if (!res.ok) {
        throw new Error(t("shortages.quantityUpdateError"));
      }

      const cardName = resolved.cardName || target.cardName || target.cardSlug;
      showToast(
        delta > 0
          ? t("shortages.quickAddSuccess", { quantity: delta, cardName })
          : t("shortages.quickRemoveSuccess", { quantity: Math.abs(delta), cardName }),
        delta > 0 ? "success" : "info",
      );
      await load(true);
    } catch (e: any) {
      showToast(e.message || t("shortages.quantityUpdateError"), "error");
    } finally {
      setAddingSlug(null);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(t("decks.deleteDeckModalTitle"), "info");
      window.location.href = "/decks";
    } catch {
      showToast(t("common.error"), "error");
      setDeleting(false);
    }
  };

  if (notFound) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("decks.deleteDeck")}
        description={t("decks.deleteConfirm")}
        action={
          <Button asChild variant="outline">
            <a href="/decks">{t("settings.backLink")}</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <a href="/decks" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("decks.allDecks")}
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
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    {deck.format}
                  </span>
                </div>
                <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">{deck.name}</h1>
                <p className="text-sm text-slate-400">{deck.champion || t("decks.noChampionSet")}</p>
              </>
            ) : (
              <div className="space-y-2">
                <div className="skeleton h-7 w-56 rounded" />
                <div className="skeleton h-4 w-32 rounded" />
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setEditing(true)}
            disabled={!deck}
            variant="outline"
            className="hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-300"
          >
            <Pencil className="h-4 w-4" /> {t("decks.editDeck")}
          </Button>
          <Button onClick={copyOmnidex} disabled={!omnidexText} variant="outline">
            {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}{" "}
            {t("decks.exportOmnidex")}
          </Button>
          <Button
            onClick={() => setConfirmDelete(true)}
            disabled={!deck}
            variant="outline"
            className="hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300"
            aria-label={t("decks.deleteDeck")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-2xl" />
          <div className="divide-y divide-white/[0.04] rounded-2xl glass">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {shortage && <FeasibilityBanner report={shortage} />}

          {/* View Toggle & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">{t("decks.contentAndVisuals")}</span>
              <div className="inline-flex rounded-lg border border-white/[0.08] bg-slate-900/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "grid"
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={t("decks.gridView")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>{t("decks.gridView")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={t("decks.listView")}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>{t("decks.listView")}</span>
                </button>
              </div>
            </div>

            <label htmlFor="only-missing" className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
              <Switch id="only-missing" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
              <span>{t("decks.onlyShowShortages")}</span>
            </label>
          </div>

          {viewMode === "grid" ? (
            <section className="rounded-2xl glass p-5 animate-fade-in" aria-label={t("decks.gridView")}>
              <DeckCardGrid
                cards={cards}
                shortageItems={shortage?.items || []}
                onlyMissing={onlyMissing}
                onAddOne={(cardSlug, cardName, assignedEditionId) =>
                  adjustCopies({ cardSlug, cardName, assignedEditionId }, 1, 0)
                }
                onAddMissing={(item) =>
                  adjustCopies(item, item.missingQuantity, item.availableQuantity)
                }
                addingSlug={addingSlug}
              />
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="rounded-2xl glass p-5 lg:col-span-2" aria-label={t("decks.demandAndContention")}>
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-white">{t("decks.demandAndContention")}</h2>
                  <p className="text-[11px] text-slate-500">{t("decks.demandHint")}</p>
                </div>
                <ShortageTable
                  items={shortage?.items || []}
                  onAddMissing={(item) =>
                    adjustCopies(item, item.missingQuantity, item.availableQuantity)
                  }
                  onAdjustQuantity={(item, delta) =>
                    adjustCopies(item, delta, item.availableQuantity)
                  }
                  addingSlug={addingSlug}
                  onlyMissing={onlyMissing}
                />
              </section>
              <aside className="rounded-2xl glass p-5" aria-label={t("decks.decksTab")}>
                <DeckList {...cards} />
              </aside>
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={t("decks.deleteDeckModalTitle")}
          message={t("decks.deleteDeckModalMessage", { name: deck?.name || "" })}
          confirmLabel={t("decks.deleteDeck")}
          busy={deleting}
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {editing && deck && (
        <DeckFormModal
          mode="edit"
          initialDeck={{
            id: deck.id,
            name: deck.name,
            champion: deck.champion,
            omnidexText,
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            showToast(t("decks.deckUpdated"), "success");
            load(true);
          }}
        />
      )}
    </div>
  );
}
