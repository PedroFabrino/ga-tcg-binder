"use client";

import Image from "next/image";
import { Store, ShoppingCart, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import type { AggregatedShortageCard } from "@/services/shortage";

interface ShortageCardRowProps {
  card: AggregatedShortageCard;
  onCardUpdated: () => void;
  onOpenQuickAdd: (card: AggregatedShortageCard) => void;
}

export default function ShortageCardRow({
  card,
  onCardUpdated,
  onOpenQuickAdd,
}: ShortageCardRowProps) {
  const { showToast } = useToast();
  const { t } = useTranslation();

  const handleReEnableWatch = async (watchlistId: string) => {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "re_enable", watchlistId }),
      });
      if (!res.ok) throw new Error();
      showToast(t("common.success"), "success");
      onCardUpdated();
    } catch {
      showToast(t("common.error"), "error");
    }
  };

  const activeWatchlistItems = card.watchlistItems || [];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-white/[0.15] transition-colors">
      {/* Left: Card art + details */}
      <div className="flex items-start gap-3.5">
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-slate-900">
          {card.imageUrl ? (
            <Image
              src={card.imageUrl}
              alt={card.cardName}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-slate-600">
              GA
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="font-semibold text-white text-sm">{card.cardName}</h4>
            <span className="rounded-full bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 text-[10px] text-slate-300 font-medium">
              {card.element}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {card.class} · {card.type}
            </span>
          </div>

          {/* Pricing & Vendor link */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {card.marketLowestPriceBrl ? (
              <span className="font-mono text-emerald-400 font-medium">
                {card.marketLowestPriceStr || `R$ ${card.marketLowestPriceBrl.toFixed(2)}`}
              </span>
            ) : null}

            {card.marketTcgPrice && (
              <span className="text-[11px] text-slate-400 font-mono">
                TCG: {card.marketTcgPrice}
              </span>
            )}

            {card.marketProductUrl && (
              <a
                href={card.marketProductUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
              >
                <ShoppingCart className="h-3 w-3" />
                MyP
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}

            {card.marketVendorName && card.marketVendorUrl && (
              <a
                href={card.marketVendorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-200 hover:bg-sky-400/20 transition-colors"
                title={t("shortages.vendorOfferTooltip", { vendor: card.marketVendorName || "" })}
              >
                <Store className="h-2.5 w-2.5 text-sky-300" />
                {t("common.vendor")}: <strong className="font-semibold text-white">{card.marketVendorName}</strong>
              </a>
            )}
          </div>

          {/* Decks needing this card */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{t("common.decks")}:</span>
            {card.deckRequirements.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-300 font-medium"
              >
                {d.deckName} <span className="ml-1 text-cyan-300 font-mono">x{d.quantity}</span>
              </span>
            ))}
          </div>

          {/* Watchlist managed printings */}
          {activeWatchlistItems.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{t("common.watchlist")}:</span>
              {activeWatchlistItems.map((wl) => (
                <span
                  key={wl.id}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${
                    wl.status === "watching"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : wl.status === "pending_add"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : wl.status === "pending_update"
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                      : wl.status === "pending_remove"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                  }`}
                >
                  <span className="font-semibold">{wl.editionSlug} #{wl.collectorNumber}:</span>
                  {wl.status === "watching" && <span>{t("watchlist.statusWatching")} ({wl.targetQuantity}x)</span>}
                  {wl.status === "pending_add" && <span>{t("watchlist.statusPendingAdd")} ({wl.targetQuantity}x)</span>}
                  {wl.status === "pending_update" && <span>{t("watchlist.statusPendingUpdate")} ({wl.targetQuantity}x)</span>}
                  {wl.status === "pending_remove" && <span>{t("watchlist.statusPendingRemove")}</span>}
                  {wl.status === "ignored" && (
                    <span className="inline-flex items-center gap-1">
                      <span>{t("watchlist.statusIgnored")}</span>
                      <button
                        type="button"
                        onClick={() => handleReEnableWatch(wl.id)}
                        className="underline hover:text-white ml-0.5 cursor-pointer font-bold"
                        title={t("watchlist.reEnableWatchBtn")}
                      >
                        {t("watchlist.reEnableWatchBtn")}
                      </button>
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle: Shortage Quantities */}
      <div className="flex flex-wrap items-center gap-4 text-xs md:text-right">
        <div>
          <span className="block text-slate-500 text-[10px] uppercase tracking-wider">{t("common.demand")}</span>
          <span className="font-mono text-sm font-semibold text-slate-200">
            {card.totalDemand}x ({t("common.peak")} {card.peakDemand}x)
          </span>
        </div>

        <div>
          <span className="block text-slate-500 text-[10px] uppercase tracking-wider">{t("common.owned")}</span>
          <span className="font-mono text-sm font-semibold text-slate-200">
            {card.totalOwned}x
          </span>
        </div>

        <div>
          <span className="block text-rose-400 text-[10px] uppercase tracking-wider font-semibold">
            {t("common.missing")}
          </span>
          <span className="font-mono text-base font-bold text-rose-300">
            {card.concurrentMissing}x
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenQuickAdd(card)}
          className="gap-1 text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" />
          {t("common.addToBinder")}
        </Button>
      </div>
    </div>
  );
}
