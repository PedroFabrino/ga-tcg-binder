"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Sparkles, Gem, TrendingUp, Upload, Download, LayoutGrid, Table2, Plus, SearchX, Store, RefreshCw } from "lucide-react";
import { PageHeader, Tabs } from "@/components/common";
import { isCollectionViewAvailable, resolveCollectionView, type CollectionView } from "@/lib/collection-views";
import { SkeletonRow, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import CollectionTable from "@/components/collection/CollectionTable";
import BinderView from "@/components/collection/BinderView";
import CollectionSearchBar from "@/components/collection/CollectionSearchBar";
import QuickAddModal from "@/components/collection/QuickAddModal";
import BulkImportModal from "@/components/collection/BulkImportModal";
import CollectionExportModal from "@/components/collection/CollectionExportModal";
import MypStoreView from "@/components/collection/MypStoreView";
import { filterCollectionItems } from "@/components/collection/filter";
import type { CollectionItem } from "@/components/collection/types";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";
import { useTranslation } from "@/lib/i18n";
import { useCollectionQuery, useVendorCapabilityQuery } from "@/hooks/queries/use-collection-queries";
import { invalidateCollectionQueries } from "@/lib/query-invalidation";

type View = CollectionView;

const TAB_KEYS: Record<View, "collection.allCardsTab" | "collection.staplesTab" | "collection.lowPopTab" | "collection.idleTab" | "collection.mypStoreTab"> = {
  ALL: "collection.allCardsTab",
  STAPLES: "collection.staplesTab",
  LOW_POP: "collection.lowPopTab",
  IDLE: "collection.idleTab",
  MYP_STORE: "collection.mypStoreTab",
};

const TAB_ICONS: Record<View, any> = {
  ALL: Layers,
  STAPLES: TrendingUp,
  LOW_POP: Gem,
  IDLE: Sparkles,
  MYP_STORE: Store,
};

const EMPTY_TITLE_KEYS: Record<View, "collection.emptyBinderTitle" | "collection.emptyStaplesTitle" | "collection.emptyLowPopTitle" | "collection.emptyIdleTitle" | "collection.emptyMypStoreTitle"> = {
  ALL: "collection.emptyBinderTitle",
  STAPLES: "collection.emptyStaplesTitle",
  LOW_POP: "collection.emptyLowPopTitle",
  IDLE: "collection.emptyIdleTitle",
  MYP_STORE: "collection.emptyMypStoreTitle",
};

const EMPTY_DESC_KEYS: Record<View, "collection.emptyBinderDesc" | "collection.emptyBinderDescNoScanner" | "collection.emptyStaplesDesc" | "collection.emptyLowPopDesc" | "collection.emptyIdleDesc" | "collection.emptyMypStoreDesc"> = {
  ALL: FEATURES.scanner ? "collection.emptyBinderDesc" : "collection.emptyBinderDescNoScanner",
  STAPLES: "collection.emptyStaplesDesc",
  LOW_POP: "collection.emptyLowPopDesc",
  IDLE: "collection.emptyIdleDesc",
  MYP_STORE: "collection.emptyMypStoreDesc",
};

export default function CollectionPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<View>("ALL");
  const [mode, setMode] = useState<"table" | "binder">("table");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: vendorCap } = useVendorCapabilityQuery(session?.user?.id ?? null);
  const hasVendorCapability = Boolean(vendorCap);

  useEffect(() => {
    setActiveTab(resolveCollectionView(window.location.search, window.location.hash, hasVendorCapability));
  }, [hasVendorCapability]);

  const {
    data: serverItems,
    isLoading,
    isError: error,
    isFetching,
    refetch: refetchCollection,
  } = useCollectionQuery(activeTab, session?.user?.id);

  useEffect(() => {
    if (serverItems) {
      setItems(serverItems);
    }
  }, [serverItems]);

  const postCollection = async (body: object) => {
    const res = await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, userId: session?.user?.id }),
    });
    if (!res.ok) throw new Error();
  };

  const handleQuantity = async (item: CollectionItem, delta: number) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)));
    try {
      await postCollection({ editionId: item.editionId, foil: item.foil, quantity: delta });
      showToast(
        delta > 0 ? `Added 1x ${item.foil ? "Foil " : ""}${item.cardName} to Binder` : `Removed 1x ${item.foil ? "Foil " : ""}${item.cardName}`,
        delta > 0 ? "success" : "info"
      );
      await invalidateCollectionQueries(queryClient);
    } catch {
      showToast("Couldn't update quantity", "error");
    }
  };

  const handleToggleDedicated = async (item: CollectionItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isDedicated: !i.isDedicated } : i)));
    try {
      await postCollection({ editionId: item.editionId, foil: item.foil, quantity: 0, isDedicated: !item.isDedicated });
      showToast(`${item.cardName} is now ${item.isDedicated ? "shared across decks" : "dedicated to one deck"}`, "info");
      await invalidateCollectionQueries(queryClient);
    } catch {
      showToast("Couldn't change sharing rule", "error");
    }
  };

  const handleQuickAdd = async (edition: any, cardName: string, foil: boolean) => {
    try {
      await postCollection({ editionId: edition.id, foil, quantity: 1 });
      showToast(`Added 1x ${foil ? "Foil " : ""}${cardName} to Binder`, "success");
      await invalidateCollectionQueries(queryClient);
    } catch {
      showToast("Couldn't add card", "error");
    }
  };

  const filteredItems = useMemo(() => {
    return filterCollectionItems(items, searchQuery);
  }, [items, searchQuery]);

  const totalCopies = useMemo(() => items.reduce((acc, i) => acc + i.quantity, 0), [items]);
  const filteredCopies = useMemo(() => filteredItems.reduce((acc, i) => acc + i.quantity, 0), [filteredItems]);
  const isFiltered = searchQuery.trim().length > 0;

  const visibleTabs = useMemo(
    () =>
      (["ALL", "STAPLES", "LOW_POP", "IDLE", "MYP_STORE"] as View[])
        .filter((tab) => isCollectionViewAvailable(tab, hasVendorCapability))
        .map((tab) => ({
          id: tab,
          label: t(TAB_KEYS[tab]),
          icon: TAB_ICONS[tab],
        })),
    [t, hasVendorCapability]
  );

  const handleTabChange = (nextTab: View) => {
    setActiveTab(nextTab);
    const url = new URL(window.location.href);
    if (nextTab === "ALL") {
      url.searchParams.delete("view");
      url.hash = "";
    } else {
      url.searchParams.set("view", nextTab.toLowerCase().replace("_", "-"));
    }
    window.history.replaceState(null, "", url.toString());
  };

  const loading = isLoading && items.length === 0;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow={t("collection.title")}
        title={t("collection.title")}
        description={t("collection.subtitle")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchCollection();
                showToast(t("common.refresh"), "info");
              }}
              className="gap-1.5 text-xs text-slate-400 hover:text-slate-200"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <span
              className="rounded-full border border-white/[0.08] px-3 py-1.5 font-mono text-xs text-slate-300"
              title={isFiltered ? `Filtered from ${totalCopies.toLocaleString()} total copies across ${items.length} printings` : undefined}
            >
              {isFiltered ? (
                <>
                  <span className="font-semibold text-cyan-300">{filteredCopies.toLocaleString()}</span> / {totalCopies.toLocaleString()} copies ({filteredItems.length} card{filteredItems.length === 1 ? "" : "s"})
                </>
              ) : (
                `${totalCopies.toLocaleString()} copies`
              )}
            </span>
            <Button onClick={() => setShowAddModal(true)} variant="default">
              <Plus className="h-4 w-4" /> {t("collection.addCard")}
            </Button>
            <Button onClick={() => setShowBulk(true)} variant="outline">
              <Upload className="h-4 w-4" /> {t("collection.bulkImport")}
            </Button>
            <Button onClick={() => setShowExport(true)} variant="outline">
              <Download className="h-4 w-4" /> {t("collection.exportCollection")}
            </Button>
          </>
        }
      />

      {activeTab !== "MYP_STORE" && (
        <CollectionSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search collection by card name, set, or collector number..."
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={visibleTabs} active={activeTab} onChange={handleTabChange} />
        {activeTab !== "MYP_STORE" && (
          <div className="inline-flex self-start rounded-xl border border-white/[0.06] bg-white/[0.02] p-1" role="group" aria-label="View mode">
            {[
              { id: "table" as const, label: "Pro Table", icon: Table2 },
              { id: "binder" as const, label: "9-Pocket", icon: LayoutGrid },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${mode === id ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === "MYP_STORE" && hasVendorCapability ? (
        <MypStoreView />
      ) : error && !loading ? (
        <EmptyState icon={Layers} title="We couldn't load your binder" description="Check your connection and try again." action={<Button variant="outline" onClick={() => refetchCollection()}>Retry</Button>} />
      ) : loading ? (
        <div className="divide-y divide-white/[0.04] rounded-2xl glass">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Layers} title={t(EMPTY_TITLE_KEYS[activeTab])} description={t(EMPTY_DESC_KEYS[activeTab])} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`No cards match "${searchQuery}"`}
          description={`None of the cards in your ${t(TAB_KEYS[activeTab])} view match this search.`}
          action={<Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>}
        />
      ) : (
        <div key={`${mode}-${activeTab}-${searchQuery}`} className="animate-fade-in">
          {mode === "table" ? (
            <CollectionTable items={filteredItems} onQuantity={handleQuantity} onToggleDedicated={handleToggleDedicated} />
          ) : (
            <BinderView items={filteredItems} onQuantity={handleQuantity} onToggleDedicated={handleToggleDedicated} />
          )}
        </div>
      )}

      {showAddModal && (
        <QuickAddModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleQuickAdd}
        />
      )}

      {showBulk && (
        <BulkImportModal
          onClose={() => setShowBulk(false)}
          onImported={(n) => {
            if (n > 0) showToast(`Imported ${n} ${n === 1 ? "copy" : "copies"} into your binder`, "success");
            invalidateCollectionQueries(queryClient);
          }}
        />
      )}

      {showExport && (
        <CollectionExportModal
          onClose={() => setShowExport(false)}
          currentItems={filteredItems}
          userId={session?.user?.id}
          activeTabTitle={t(TAB_KEYS[activeTab])}
          isFiltered={isFiltered}
        />
      )}
    </div>
  );
}
