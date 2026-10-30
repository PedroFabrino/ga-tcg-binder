"use client";

import { useState } from "react";
import { Check, Copy, ArrowRight, Minus, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import type { DeckAdvisorSwapProposal, DeckZone } from "@ga/contracts";

interface DeckAdvisorSwapCardProps {
  proposal: DeckAdvisorSwapProposal;
  deckId: string;
  onDeckUpdated?: () => void;
}

export function DeckAdvisorSwapCard({
  proposal,
  deckId,
  onDeckUpdated,
}: DeckAdvisorSwapCardProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);

  const getZoneLabel = (zone: DeckZone) => {
    switch (zone) {
      case "material":
        return t("advisor.zoneMaterial");
      case "side":
        return t("advisor.zoneSide");
      case "main":
      default:
        return t("advisor.zoneMain");
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "binder_available":
        return (
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
            {t("advisor.tierBinderAvailable")}
          </span>
        );
      case "store_pullback":
        return (
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            {t("advisor.tierStorePullback")}
          </span>
        );
      case "unowned_upgrade":
      default:
        return (
          <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
            {t("advisor.tierUnownedUpgrade")}
          </span>
        );
    }
  };

  const getImpactBadge = () => {
    switch (proposal.netImpact) {
      case "immediate":
        return (
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            {t("advisor.impactImmediate")}
          </span>
        );
      case "store_pullback":
        return (
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            {t("advisor.impactStorePullback")}
          </span>
        );
      case "hard_shortage":
      default:
        return (
          <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            {t("advisor.impactHardShortage")}
          </span>
        );
    }
  };

  const handleCopyOmnidex = async () => {
    if (!proposal.updatedOmnidexText) return;
    try {
      await navigator.clipboard.writeText(proposal.updatedOmnidexText);
      setCopied(true);
      showToast(t("advisor.omnidexCopied"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("advisor.errorOccurred"), "error");
    }
  };

  const handleApplySwap = async () => {
    if (!proposal.updatedOmnidexText || applying) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ omnidexText: proposal.updatedOmnidexText }),
      });

      if (!res.ok) {
        throw new Error(t("advisor.errorOccurred"));
      }

      showToast(t("advisor.swapApplied"), "success");
      onDeckUpdated?.();
    } catch {
      showToast(t("advisor.errorOccurred"), "error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-cyan-500/20 bg-slate-900/90 p-3.5 text-xs shadow-lg space-y-3">
      {/* Title & Impact Header */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-300">
            <ArrowRight className="h-3 w-3" />
          </span>
          <h4 className="font-semibold text-white tracking-tight">{proposal.title}</h4>
        </div>
        <div>{getImpactBadge()}</div>
      </div>

      {/* Cuts & Adds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Cuts */}
        {proposal.cuts.length > 0 && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-300">
              <Minus className="h-3 w-3" />
              <span>{t("advisor.cutsLabel")}</span>
            </div>
            <ul className="space-y-1">
              {proposal.cuts.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-slate-300">
                  <span className="truncate flex items-center gap-1.5">
                    <strong className="text-rose-400">-{c.quantity}</strong>
                    <CardPreviewTrigger
                      name={c.cardName}
                      className="cursor-pointer hover:text-white hover:underline decoration-rose-400/50 transition-colors"
                    >
                      {c.cardName}
                    </CardPreviewTrigger>
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400 px-1 py-0.5 bg-slate-800 rounded">
                    {getZoneLabel(c.zone)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Adds */}
        {proposal.adds.length > 0 && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              <Plus className="h-3 w-3" />
              <span>{t("advisor.addsLabel")}</span>
            </div>
            <ul className="space-y-1">
              {proposal.adds.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-slate-300">
                  <span className="truncate flex items-center gap-1.5">
                    <strong className="text-emerald-400">+{a.quantity}</strong>
                    <CardPreviewTrigger
                      name={a.cardName}
                      className="cursor-pointer hover:text-white hover:underline decoration-emerald-400/50 transition-colors"
                    >
                      {a.cardName}
                    </CardPreviewTrigger>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-400 px-1 py-0.5 bg-slate-800 rounded">
                      {getZoneLabel(a.zone)}
                    </span>
                    {getTierBadge(a.tier)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Rationale */}
      {proposal.rationale && (
        <div className="pt-1 text-[11px] text-slate-300 leading-relaxed border-t border-white/[0.04]">
          <span className="font-semibold text-slate-400 mr-1">{t("advisor.rationaleLabel")}:</span>
          {proposal.rationale}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.08]">
        <Button
          type="button"
          onClick={handleCopyOmnidex}
          variant="outline"
          size="sm"
          className="h-7 text-xs border-white/[0.1] bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          {copied ? (
            <Check className="h-3 w-3 mr-1 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3 mr-1 text-slate-400" />
          )}
          {t("advisor.copyUpdatedOmnidex")}
        </Button>
        <Button
          type="button"
          onClick={handleApplySwap}
          disabled={applying}
          size="sm"
          className="h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
        >
          {applying ? (
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <ArrowRight className="h-3 w-3 mr-1" />
          )}
          {applying ? t("advisor.applyingSwap") : t("advisor.applySwap")}
        </Button>
      </div>
    </div>
  );
}
