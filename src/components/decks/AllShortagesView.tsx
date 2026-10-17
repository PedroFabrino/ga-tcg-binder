"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Store, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import WatchlistSecurityModal from "./WatchlistSecurityModal";
import WatchlistSyncBanner from "./WatchlistSyncBanner";
import ShortageCardRow from "./ShortageCardRow";
import ShortageQuickAddModal from "./ShortageQuickAddModal";
import ShortageFiltersBar, { type GroupMode } from "./ShortageFiltersBar";
import { partitionPendingWatchlistItems } from "@/services/watchlist-policy";
import type {
  AggregatedShortageCard,
  AggregatedShortageReport,
} from "@/services/shortage";

interface ShortageGroup {
  key: string;
  title: string;
  cards: AggregatedShortageCard[];
  color?: string;
  vendorUrl?: string | null;
  totalCostBrl?: number;
}

export default function AllShortagesView({
  report,
  onRefresh,
}: {
  report: AggregatedShortageReport | null;
  onRefresh: () => void;
  loading?: boolean;
}) {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [syncingAutomated, setSyncingAutomated] = useState(false);
  const [quickAddCard, setQuickAddCard] = useState<AggregatedShortageCard | null>(null);

  const { pendingAdds, pendingUpdates, pendingRemoves } = useMemo(() => {
    if (!report?.cards) {
      return { pendingAdds: [], pendingUpdates: [], pendingRemoves: [] };
    }
    return partitionPendingWatchlistItems(report.cards);
  }, [report?.cards]);

  const toggleElement = (el: string) => {
    setSelectedElements((prev) =>
      prev.includes(el) ? prev.filter((x) => x !== el) : [...prev, el]
    );
  };

  const toggleRarity = (r: number) => {
    setSelectedRarities((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const handlePolicyChange = async (policies: { hard?: boolean; shared?: boolean; staples?: boolean }) => {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_policy", policies }),
      });
      if (!res.ok) throw new Error();
      showToast(t("settings.savedToast"), "success");
      onRefresh();
    } catch {
      showToast(t("common.error"), "error");
    }
  };

  const handleAutomatedSync = async () => {
    setSyncingAutomated(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_now" }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.runner?.success) {
        showToast(
          t("watchlist.syncSuccessToast", {
            adds: json.runner.addsExecuted || 0,
            updates: json.runner.updatesExecuted || 0,
            removes: json.runner.removesExecuted || 0,
          }),
          "success"
        );
      } else {
        showToast(json.runner?.error || t("common.syncSkipped"), "error");
      }
      onRefresh();
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSyncingAutomated(false);
    }
  };

  const filteredCards = useMemo(() => {
    if (!report?.cards) return [];
    return report.cards.filter((card) => {
      if (query) {
        const q = query.toLowerCase();
        const matchesName = card.cardName.toLowerCase().includes(q);
        const matchesDeck = card.deckRequirements.some((d) => d.deckName.toLowerCase().includes(q));
        const matchesEdition = card.editions.some(
          (e) => e.setPrefix.toLowerCase().includes(q) || e.setName.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesDeck && !matchesEdition) return false;
      }
      if (selectedElements.length > 0 && !selectedElements.includes(card.element)) {
        return false;
      }
      if (selectedRarities.length > 0 && !selectedRarities.includes(card.rarity)) {
        return false;
      }
      return true;
    });
  }, [report?.cards, query, selectedElements, selectedRarities]);

  const groupedData = useMemo<ShortageGroup[]>(() => {
    if (groupMode === "none") {
      return [{ key: "all", title: t("common.allShortages"), cards: filteredCards }];
    }
    if (groupMode === "element") {
      const map = new Map<string, AggregatedShortageCard[]>();
      for (const card of filteredCards) {
        const el = card.element || "NORM";
        if (!map.has(el)) map.set(el, []);
        map.get(el)!.push(card);
      }
      return Array.from(map.entries()).map(([el, cards]) => ({
        key: el,
        title: el,
        cards,
      }));
    }
    if (groupMode === "vendor") {
      const map = new Map<string, { cards: AggregatedShortageCard[]; vendorUrl?: string | null; totalCost: number }>();
      for (const card of filteredCards) {
        const vendorKey = card.marketVendorName || t("common.otherMarketplace");
        if (!map.has(vendorKey)) {
          map.set(vendorKey, { cards: [], vendorUrl: card.marketVendorUrl, totalCost: 0 });
        }
        const group = map.get(vendorKey)!;
        group.cards.push(card);
        if (card.marketLowestPriceBrl) {
          group.totalCost += card.marketLowestPriceBrl * card.concurrentMissing;
        }
      }
      return Array.from(map.entries())
        .map(([vendor, data]) => ({
          key: vendor,
          title: vendor,
          vendorUrl: data.vendorUrl,
          totalCostBrl: data.totalCost,
          cards: data.cards,
        }))
        .sort((a, b) => b.cards.length - a.cards.length);
    }
    return [{ key: "all", title: t("common.allShortages"), cards: filteredCards }];
  }, [filteredCards, groupMode, t]);

  const summary = report?.summary;
  const isAllCovered = summary && summary.totalShortageCopies === 0 && summary.deckCount > 0;

  return (
    <div className="space-y-6">
      {summary && summary.deckCount > 0 && (
        <WatchlistSyncBanner
          summary={summary}
          pendingAddsCount={pendingAdds.length}
          pendingUpdatesCount={pendingUpdates.length}
          pendingRemovesCount={pendingRemoves.length}
          onPolicyChange={handlePolicyChange}
          onTriggerSyncNow={handleAutomatedSync}
          onOpenBrowserBridge={() => setShowSecurityModal(true)}
          syncingAutomated={syncingAutomated}
        />
      )}

      <ShortageFiltersBar
        query={query}
        setQuery={setQuery}
        groupMode={groupMode}
        setGroupMode={setGroupMode}
        selectedElements={selectedElements}
        toggleElement={toggleElement}
        clearElements={() => setSelectedElements([])}
        selectedRarities={selectedRarities}
        toggleRarity={toggleRarity}
        clearRarities={() => setSelectedRarities([])}
      />

      {/* Main List */}
      {isAllCovered || filteredCards.length === 0 ? (
        <div className="rounded-2xl glass p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400/60" />
          <h3 className="mt-4 text-base font-semibold text-white">{t("shortages.emptyStateTitle")}</h3>
          <p className="mt-1 text-xs text-slate-400">{t("shortages.emptyStateDesc")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedData.map((group) => (
            <div key={group.key} className="space-y-3">
              {groupMode !== "none" && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-white" style={group.color ? { color: group.color } : undefined}>
                      {group.title}
                    </h3>
                    {group.totalCostBrl !== undefined && group.totalCostBrl > 0 && (
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                        {t("shortages.groupTotalCost", { total: group.totalCostBrl.toFixed(2).replace(".", ",") })}
                      </span>
                    )}
                  </div>
                  {group.vendorUrl && (
                    <a
                      href={group.vendorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
                    >
                      <Store className="h-3.5 w-3.5" />
                      {t("common.visitStore")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {group.cards.map((card) => (
                  <ShortageCardRow
                    key={`${group.key}-${card.cardSlug}`}
                    card={card}
                    onCardUpdated={onRefresh}
                    onOpenQuickAdd={(c) => setQuickAddCard(c)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSecurityModal && (
        <WatchlistSecurityModal
          onClose={() => setShowSecurityModal(false)}
          userId={session?.user?.id || "user_default"}
          syncToken={report?.summary?.watchlistSyncToken as string | undefined}
          pendingAdds={pendingAdds}
          pendingUpdates={pendingUpdates}
          pendingRemoves={pendingRemoves}
        />
      )}

      {quickAddCard && (
        <ShortageQuickAddModal
          card={quickAddCard}
          onClose={() => setQuickAddCard(null)}
          onAdded={onRefresh}
        />
      )}
    </div>
  );
}
