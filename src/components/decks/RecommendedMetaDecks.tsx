"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export interface RecommendedMetaArchetype {
  id: string;
  name: string;
  champion?: string | null;
  decklist: string;
  completionPct: number;
  missingCardsCount: number;
}

export interface RecommendedMetaDecksProps {
  archetypes: RecommendedMetaArchetype[];
  onImport: (archetype: RecommendedMetaArchetype) => Promise<void>;
}

export function RecommendedMetaDecks({ archetypes, onImport }: RecommendedMetaDecksProps) {
  const { t } = useTranslation();

  if (!archetypes || archetypes.length === 0) return null;

  return (
    <div className="rounded-2xl glass border border-emerald-400/25 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-300 font-bold">✨</span>
          <h2 className="text-sm font-bold text-white">{t("meta.sectionRecommended")}</h2>
        </div>
        <Link href="/meta" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
          {t("meta.sectionAllArchetypes")} →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {archetypes.slice(0, 3).map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/30 p-3 hover:border-emerald-400/40 transition-colors"
          >
            <div className="min-w-0 mr-3">
              <div className="font-semibold text-white text-xs truncate">{m.name}</div>
              <div className="text-[11px] text-slate-400">
                <span className="font-mono text-emerald-300 font-bold">{m.completionPct}%</span>
                {m.missingCardsCount > 0
                  ? ` · ${m.missingCardsCount} ${t("common.missing")}`
                  : ` · ${t("decks.feasibilityReady")}`}
              </div>
            </div>
            <Button
              onClick={() => onImport(m)}
              size="sm"
              variant="outline"
              className="text-xs border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10 shrink-0"
            >
              {t("meta.importBtn")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
