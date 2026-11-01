"use client";

import { ExternalLink, Loader2, Swords, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export interface MetaArchetype {
  id: string;
  name: string;
  tier: string;
  champion: string;
  element?: string | null;
  signatureCardImageUrl?: string | null;
  shareRate: string;
  winRate: string;
  deckCount?: number | null;
  decklist: string;
  detailUrl?: string | null;
  sampleEventDeckUrl?: string | null;
  sourceUrl?: string | null;
  completionPct?: number;
  binderPct?: number;
  mypStorePct?: number;
  totalCoreRequired?: number;
  totalCoreOwned?: number;
  binderCardsOwned?: number;
  mypStoreCardsOwned?: number;
  missingCardsCount?: number;
  missingAvailableOnMarketCount?: number;
  estimatedCostToCompleteBrl?: number;
  isRecommended?: boolean;
}

function pctValue(v: string) {
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? 0 : n;
}

export function ArchetypeCard({
  meta,
  onCompare,
  onImport,
  importing,
}: {
  meta: MetaArchetype;
  onCompare: () => void;
  onImport: () => void;
  importing: boolean;
}) {
  const { t } = useTranslation();
  const completion = meta.completionPct ?? 0;

  return (
    <article className="hover-lift group flex flex-col rounded-2xl glass p-5 relative">
      {/* Top Banner / Recommendation Pill */}
      {meta.isRecommended && (
        <div className="mb-2 inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
          <span>{t("meta.recommendedBadge")}</span>
        </div>
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">{meta.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {meta.champion}
            {meta.element ? ` · ${meta.element}` : ""}
          </p>
        </div>
        <span
          className={`tier-${meta.tier.replace(/\s+/g, "")} shrink-0 rounded-lg px-2 py-0.5 font-mono text-xs font-bold border border-white/10`}
        >
          {meta.tier}
        </span>
      </div>

      {/* Archetype Completion Progress Bar */}
      {meta.totalCoreRequired && meta.totalCoreRequired > 0 ? (
        <div className="mb-3 rounded-xl border border-white/[0.06] bg-black/30 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">
              {t("meta.ownedPct", { pct: completion })}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {t("meta.coreCardsProgress", {
                owned: meta.totalCoreOwned ?? 0,
                required: meta.totalCoreRequired ?? 0,
              })}
            </span>
          </div>

          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08] flex">
            {meta.binderPct && meta.binderPct > 0 ? (
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${meta.binderPct}%` }}
                title={`Binder: ${meta.binderCardsOwned} cards`}
              />
            ) : null}
            {meta.mypStorePct && meta.mypStorePct > 0 ? (
              <div
                className="h-full bg-amber-400"
                style={{ width: `${meta.mypStorePct}%` }}
                title={`MyP Store: ${meta.mypStoreCardsOwned} cards`}
              />
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1">
            <div className="flex items-center gap-2">
              <span className="text-cyan-300">
                {t("meta.binderCopies", { count: meta.binderCardsOwned || 0 })}
              </span>
              {(meta.mypStoreCardsOwned || 0) > 0 && (
                <span className="text-amber-300">
                  {t("meta.mypStoreCopies", { count: meta.mypStoreCardsOwned ?? 0 })}
                </span>
              )}
            </div>
            {(meta.missingCardsCount || 0) > 0 && (
              <span className="font-mono text-slate-400">
                {t("meta.missingCount", { count: meta.missingCardsCount ?? 0 })}
              </span>
            )}
          </div>

          {/* Cost to complete on MyP */}
          {(meta.missingCardsCount || 0) > 0 && (
            <div className="mt-2 border-t border-white/[0.06] pt-1.5 text-[10px] text-slate-400 flex items-center justify-between">
              <span>{t("meta.mypMarketLabel")}</span>
              <span className="font-mono text-emerald-300 font-medium">
                {meta.missingAvailableOnMarketCount && meta.missingAvailableOnMarketCount > 0 ? (
                  t("meta.inStockFrom", {
                    available: meta.missingAvailableOnMarketCount,
                    missing: meta.missingCardsCount ?? 0,
                    price: (meta.estimatedCostToCompleteBrl || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }),
                  })
                ) : (
                  <span className="text-slate-500">{t("meta.outOfStock")}</span>
                )}
              </span>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Win Rate", value: meta.winRate, bar: "bg-emerald-400", max: 70 },
          { label: "Meta Share", value: meta.shareRate, bar: "bg-cyan-400", max: 30 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.05] bg-black/20 p-2.5">
            <div className="label-caps !text-[9px]">{s.label}</div>
            <div className="mt-0.5 font-mono text-base font-semibold text-white">{s.value}</div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${s.bar}`}
                style={{ width: `${Math.min(100, (pctValue(s.value) / s.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-3">
        <Button
          onClick={onCompare}
          variant="outline"
          size="sm"
          className="flex-1 text-xs group-hover:border-cyan-400/30 group-hover:text-cyan-200"
        >
          <Swords className="h-3.5 w-3.5 mr-1" /> {t("meta.compareAction")}
        </Button>
        <Button
          onClick={onImport}
          disabled={importing}
          variant="default"
          size="sm"
          className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold text-xs"
        >
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5 mr-1" />}
          {t("meta.importAction")}
        </Button>
        {meta.sourceUrl && (
          <Button asChild variant="outline" size="sm" className="px-2">
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("meta.viewStats", { name: meta.name })}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
