"use client";

import Link from "next/link";
import {
  Store,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  CardArt,
  ElementBadge,
  RarityGem,
  FoilBadge,
} from "@/components/common";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { GlobalMarketplaceCardItem } from "@/services/marketplace";
import MarketplaceAddToBinder from "./MarketplaceAddToBinder";

export interface MarketplaceCardRowProps {
  card: GlobalMarketplaceCardItem;
  onAddedToBinder?: (cardId: string, quantityAdded: number) => void;
  onEnrichTcg?: (cardId: string) => void;
  isEnrichingTcg?: boolean;
}

export default function MarketplaceCardRow({
  card,
  onAddedToBinder,
  onEnrichTcg,
  isEnrichingTcg = false,
}: MarketplaceCardRowProps) {
  const { t } = useTranslation();

  const isBuyable = card.netExternalStock > 0;
  const isHard = card.shortageTier === "HARD" && isBuyable;
  const isShared = card.shortageTier === "SHARED" && isBuyable;
  const isSelfCollision = card.personalStoreQuantity > 0 && card.netExternalStock === 0;

  return (
    <div
      className={`flex flex-col gap-4 p-4 transition-colors md:flex-row md:items-center md:justify-between ${
        isHard
          ? "bg-rose-500/[0.06] hover:bg-rose-500/[0.1]"
          : isShared
          ? "bg-amber-500/[0.05] hover:bg-amber-500/[0.09]"
          : "hover:bg-white/[0.015]"
      }`}
    >
      {/* Left: Thumbnail & Details */}
      <div className="flex items-center gap-3.5 min-w-0">
        <CardPreviewTrigger
          name={card.cardName}
          slug={card.cardSlug || undefined}
          imageUrl={card.imageUrl || undefined}
          element={card.element}
          className="shrink-0 cursor-pointer"
        >
          <div
            className={`relative h-14 w-10 overflow-hidden rounded-md border border-white/[0.1] hover:border-cyan-400/50 transition-colors ${
              card.isFoil ? "foil-shine" : ""
            }`}
          >
            <CardArt
              src={card.imageUrl || undefined}
              alt={card.cardName}
              className="h-full w-full"
            />
          </div>
        </CardPreviewTrigger>

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardPreviewTrigger
              name={card.cardName}
              slug={card.cardSlug || undefined}
              imageUrl={card.imageUrl || undefined}
              element={card.element}
              className="inline-block"
            >
              <span className="truncate text-sm font-semibold text-white hover:text-cyan-300 transition-colors cursor-pointer">
                {card.rawName}
              </span>
            </CardPreviewTrigger>

            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
              {card.setPrefix}
            </span>

            {card.storeName && (
              <span className="rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                {card.storeName}
              </span>
            )}

            {card.isFoil && <FoilBadge />}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ElementBadge element={card.element} />
            <RarityGem rarity={card.rarity} />
            <span className="text-[11px] text-slate-500">{card.class}</span>
            <span className="text-[11px] text-slate-600">·</span>
            <span className="text-[11px] text-slate-400">
              Type: <span className="text-slate-300">{card.type}</span>
            </span>
          </div>

          {/* Shortage Badges */}
          {isHard ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                <AlertTriangle className="h-3 w-3 text-rose-300" />
                Hard Shortage: Need {card.peakMissing} for {card.peakDeckName || card.deckNeeds[0]?.deckName || "Deck"}
              </span>
              {card.deckNeeds.map((d, idx) => (
                <Link
                  key={idx}
                  href={`/decks/${d.deckId}`}
                  className="inline-flex items-center rounded-md border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-100 hover:border-rose-300"
                >
                  {d.deckName} <span className="ml-1 font-mono text-rose-300">x{d.quantity}</span>
                </Link>
              ))}
            </div>
          ) : isShared ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                <Sparkles className="h-3 w-3 text-amber-300" />
                Shared Shortage: Need {card.concurrentMissing} to sleeve all decks
              </span>
              {card.deckNeeds.map((d, idx) => (
                <Link
                  key={idx}
                  href={`/decks/${d.deckId}`}
                  className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100 hover:border-amber-300"
                >
                  {d.deckName} <span className="ml-1 font-mono text-amber-300">x{d.quantity}</span>
                </Link>
              ))}
            </div>
          ) : isSelfCollision && card.shortageTier !== "NONE" ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                <Store className="h-3 w-3 text-amber-300" />
                Store Offset: All {card.personalStoreQuantity} listed copies are in your MyP Store
              </span>
              <Link
                href="/collection?view=MYP_STORE"
                className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200 hover:border-amber-400 hover:bg-amber-400/20"
              >
                Claim to Binder
              </Link>
            </div>
          ) : card.deckNeeds.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Fully Covered for:
              </span>
              {card.deckNeeds.map((d, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400"
                >
                  {d.deckName} <span className="ml-1 font-mono text-slate-300">x{d.quantity}</span>
                </span>
              ))}
            </div>
          ) : null}

          {/* Meta Staple Badge */}
          {card.isStapleDeficit ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-rose-200">
                <span>🔥 Meta Staple Deficit</span>
                {card.stapleRecommendedCopies && (
                  <span className="font-mono text-rose-300">
                    (Binder: {card.totalBinderOwned ?? 0}/{card.stapleRecommendedCopies})
                  </span>
                )}
                {card.stapleInclusionRate && <span>· {card.stapleInclusionRate}</span>}
              </span>
            </div>
          ) : card.isMetaStaple ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                <span>🔥 Meta Staple</span>
                {card.stapleInclusionRate && <span>· {card.stapleInclusionRate}</span>}
              </span>
            </div>
          ) : null}

          {/* Self-listing collision badge */}
          {card.personalStoreQuantity > 0 && !isSelfCollision && (
            <div className="mt-1 flex items-center gap-1.5">
              <Link
                href="/collection?view=MYP_STORE"
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/20"
                title="You already own copies of this card listed in your MyP Store"
              >
                <Store className="h-2.5 w-2.5 text-amber-400" />
                <span>In Your MyP Store:</span>
                <span className="font-mono font-bold text-amber-300">
                  {card.personalStoreQuantity}x
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Right: Price, Stock, In-Binder & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
        <div className="text-left md:text-right mr-2">
          <div className="font-mono text-base font-bold text-emerald-300">
            {card.price}
          </div>

          {/* Preço TCG Player Benchmark & Overpriced Alerts */}
          {card.priceFairness?.tier === "HEAVILY_OVERPRICED" ? (
            <div className="mt-1 flex flex-col items-start md:items-end">
              <span
                className="inline-flex items-center gap-1 rounded-full border border-red-500/50 bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 shadow-[0_0_12px_-2px_rgba(239,68,68,0.4)]"
                title={`Preço TCG Player: ${card.tcgPrice || "N/A"} · ${(card.priceFairness.ratio ?? 0).toFixed(1)}x baseline (+${card.priceFairness.markupPercent}%)`}
              >
                <AlertTriangle className="h-2.5 w-2.5 text-red-400" />
                HEAVILY OVERPRICED
              </span>
              <span className="text-[10px] font-mono text-red-400/80">
                TCG: {card.tcgPrice} ({(card.priceFairness.ratio ?? 0).toFixed(1)}x)
              </span>
            </div>
          ) : card.priceFairness?.tier === "SLIGHTLY_OVERPRICED" ? (
            <div className="mt-1 flex flex-col items-start md:items-end">
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
                title={`Preço TCG Player: ${card.tcgPrice || "N/A"} · ${(card.priceFairness.ratio ?? 0).toFixed(1)}x baseline (+${card.priceFairness.markupPercent}%)`}
              >
                <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                Slightly Overpriced
              </span>
              <span className="text-[10px] font-mono text-amber-400/70">
                TCG: {card.tcgPrice} (+{card.priceFairness.markupPercent}%)
              </span>
            </div>
          ) : card.priceFairness?.tier === "NORMAL" ? (
            <div className="text-[10px] font-mono text-slate-400">
              TCG: {card.tcgPrice} <span className="text-emerald-400/70">(Normal)</span>
            </div>
          ) : card.priceFairness?.tier === "BELOW_MARKET" ? (
            <div className="text-[10px] font-mono text-emerald-300">
              TCG: {card.tcgPrice} <span className="text-emerald-400 font-bold">(Below TCG)</span>
            </div>
          ) : card.mypProductUrl && onEnrichTcg ? (
            <button
              type="button"
              onClick={() => onEnrichTcg(card.id)}
              disabled={isEnrichingTcg}
              className="text-[10px] font-mono text-slate-500 hover:text-cyan-300 transition-colors cursor-pointer"
              title="Fetch Preço TCG Player from product page"
            >
              {isEnrichingTcg ? t("marketplace.checkingTcg") : t("marketplace.checkTcgPrices")}
            </button>
          ) : null}

          <div className="text-[11px] text-slate-400 mt-0.5">
            {card.personalStoreQuantity > 0 ? (
              <>
                <span className="font-mono font-semibold text-white">{card.netExternalStock}</span> from other sellers
                <span className="text-slate-500"> ({card.quantity} total)</span>
              </>
            ) : (
              <>
                <span className="font-mono font-semibold text-white">{card.quantity}</span> available
              </>
            )}
          </div>

          {/* In-Binder Quantity Display */}
          <div className="text-[11px] text-slate-400 mt-0.5">
            <span>{t("marketplace.inBinder")}: </span>
            <span className="font-mono font-semibold text-slate-200">
              {card.totalBinderOwned ?? 0}
            </span>
          </div>
        </div>

        {/* Action Controls: Add to Binder (with Stepper) & Buy on Store */}
        <div className="flex flex-wrap items-center gap-2">
          <MarketplaceAddToBinder
            card={card}
            onAdded={onAddedToBinder}
          />

          {(card.productUrl || card.mypProductUrl) && (
            isSelfCollision ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 border-amber-400/40 text-amber-200 hover:bg-amber-400/10 text-xs font-semibold"
              >
                <Link href="/collection?view=MYP_STORE" title="Manage your listings in your MyP Store">
                  <Store className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                  In Your Store
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className={`h-9 font-semibold text-xs ${
                  isHard
                    ? "bg-rose-500 text-white hover:bg-rose-400 shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]"
                    : isShared
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-[0_0_15px_-3px_rgba(251,191,36,0.3)]"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                }`}
              >
                <a
                  href={(card.productUrl || card.mypProductUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("common.buyOnStore", { store: card.storeName || "Store" })}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {t("common.buyOnStore", { store: card.storeName || "Store" })}
                </a>
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
