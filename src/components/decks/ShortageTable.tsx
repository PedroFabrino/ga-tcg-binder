"use client";

import { AlertTriangle, Check, Users, Plus, Loader2, MessageSquare, Lock, Store, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";

export interface ShortageItem {
  cardSlug: string;
  cardName: string;
  zone: string;
  imageUrl?: string | null;
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  isContended: boolean;
  contendingDeckNames: string[];
  dedicatedCopiesOwned: number;
  sharedCopiesOwned: number;
  friendsWithIdle: { friendId: string; friendName: string; friendCode: string; idleQuantity: number }[];
  mypAvailableCopies?: number;
  marketAvailableCopies?: number;
  marketLowestPriceBrl?: number;
  marketLowestPriceStr?: string;
  marketProductUrl?: string | null;
}

export interface ShortageReport {
  deckId?: string;
  deckName?: string;
  champion?: string;
  decklistText?: string;
  totalCardsRequired: number;
  totalCardsMissing: number;
  items: ShortageItem[];
}

const ZONE_STYLE: Record<string, string> = {
  material: "border-amber-300/20 text-amber-200",
  main: "border-cyan-300/20 text-cyan-200",
  side: "border-white/[0.1] text-slate-300",
};

export function FeasibilityBanner({ report, label = "Cards Ready" }: { report: ShortageReport; label?: string }) {
  const ready = report.totalCardsRequired - report.totalCardsMissing;
  const pct = report.totalCardsRequired ? Math.round((ready / report.totalCardsRequired) * 100) : 100;
  const ok = report.totalCardsMissing === 0;
  const contended = report.items.filter((i) => i.isContended).length;
  const borrowable = report.items.filter((i) => i.missingQuantity > 0 && (i.friendsWithIdle?.length ?? 0) > 0).length;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${ok ? "border-emerald-400/20 bg-emerald-500/[0.05]" : "border-rose-400/20 bg-rose-500/[0.04]"}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
            {ok ? <Check className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{ok ? "Tournament ready" : `${report.totalCardsMissing} ${report.totalCardsMissing === 1 ? "copy" : "copies"} short`}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {ok ? "Every slot is covered by copies in your binder." : "Add the missing copies to your binder or borrow idle copies from your playgroup."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {contended > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                  <AlertTriangle className="h-3 w-3" /> {contended} contended with other decks
                </span>
              )}
              {borrowable > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                  <Users className="h-3 w-3" /> {borrowable} borrowable from friends
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="font-mono text-3xl font-semibold text-white">
            {ready}<span className="text-slate-500"> / {report.totalCardsRequired}</span>
          </div>
          <div className="label-caps mt-1">{label}</div>
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progress-bar h-full rounded-full ${ok ? "el-wind" : "el-fire"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ShortageTable({
  items,
  onAddMissing,
  addingSlug,
  onlyMissing = false,
}: {
  items: ShortageItem[];
  onAddMissing?: (item: ShortageItem) => void;
  addingSlug?: string | null;
  onlyMissing?: boolean;
}) {
  const { showToast } = useToast();
  const rows = onlyMissing ? items.filter((i) => i.missingQuantity > 0) : [...items].sort((a, b) => b.missingQuantity - a.missingQuantity);

  const borrowInquiry = async (item: ShortageItem, friend: ShortageItem["friendsWithIdle"][number]) => {
    const qty = Math.min(item.missingQuantity, friend.idleQuantity);
    const msg = `Hey ${friend.friendName}! Could I borrow ${qty}x ${item.cardName} from your idle binder for my next event?`;
    try {
      await navigator.clipboard.writeText(msg);
      showToast(`Borrow request for ${friend.friendName} copied`, "success");
    } catch {
      showToast("Could not access clipboard", "error");
    }
  };

  if (rows.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-500">{onlyMissing ? "Nothing missing. You own every card." : "This deck has no cards yet."}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">Card</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Zone</th>
            <th scope="col" className="px-3 py-2.5 text-center font-semibold">Need</th>
            <th scope="col" className="px-3 py-2.5 text-center font-semibold">Have</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
            {onAddMissing && <th scope="col" className="px-3 py-2.5 text-right font-semibold">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.map((item) => {
            const short = item.missingQuantity > 0;
            return (
              <tr key={`${item.zone}-${item.cardSlug}`} className={`transition-colors hover:bg-white/[0.02] ${short ? "bg-rose-500/[0.02]" : ""}`}>
                <td className="px-3 py-3 align-top">
                  <CardPreviewTrigger
                    name={item.cardName}
                    slug={item.cardSlug}
                    imageUrl={item.imageUrl}
                    className="inline-block"
                  >
                    <div className="text-sm font-semibold text-white transition-colors hover:text-cyan-300 cursor-pointer">{item.cardName}</div>
                  </CardPreviewTrigger>
                  {item.dedicatedCopiesOwned > 0 && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                      <Lock className="h-2.5 w-2.5" /> {item.dedicatedCopiesOwned} dedicated · {item.sharedCopiesOwned} shared
                    </div>
                  )}
                  {short && item.mypAvailableCopies && item.mypAvailableCopies > 0 ? (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <a
                        href="/collection?view=MYP_STORE"
                        className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/25 transition-colors"
                        title="You have copies listed in your MyP Store that can cover this shortage"
                      >
                        <Store className="h-2.5 w-2.5 text-amber-300" />
                        {item.mypAvailableCopies} in your MyP Store
                      </a>
                    </div>
                  ) : null}
                  {short && item.marketAvailableCopies && item.marketAvailableCopies > 0 ? (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <a
                        href={item.marketProductUrl || `/marketplace?query=${encodeURIComponent(item.cardName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/25 transition-colors"
                        title={`Buy on MyP Cards starting from ${item.marketLowestPriceStr || "R$ --"}`}
                      >
                        <ExternalLink className="h-2.5 w-2.5 text-cyan-300" />
                        Buy on MyP · {item.marketLowestPriceStr || "Market"} ({item.marketAvailableCopies} avail)
                      </a>
                    </div>
                  ) : null}
                  {short && (item.friendsWithIdle?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.friendsWithIdle?.map((f) => (
                        <button
                          key={f.friendId}
                          onClick={() => borrowInquiry(item, f)}
                          title="Copy a borrow request message"
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200 transition-all hover:bg-emerald-500/20 active:scale-95"
                        >
                          <Users className="h-3 w-3" />
                          {f.friendName} ({f.idleQuantity} idle)
                          <MessageSquare className="h-2.5 w-2.5 opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ZONE_STYLE[item.zone] || ZONE_STYLE.side}`}>{item.zone}</span>
                </td>
                <td className="px-3 py-3 text-center align-top font-mono font-semibold text-slate-200">{item.requiredQuantity}</td>
                <td className={`px-3 py-3 text-center align-top font-mono font-semibold ${short ? "text-rose-300" : "text-emerald-300"}`}>{item.availableQuantity}</td>
                <td className="px-3 py-3 align-top">
                  {short ? (
                    <span className="inline-flex rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-300">-{item.missingQuantity} short</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300"><Check className="h-3 w-3" /> Covered</span>
                  )}
                  {item.isContended && (item.contendingDeckNames?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-300/90">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>Also used in {item.contendingDeckNames.map((n) => `'${n}'`).join(", ")}</span>
                    </div>
                  )}
                </td>
                {onAddMissing && (
                  <td className="px-3 py-3 text-right align-top">
                    {short && (
                      <button
                        onClick={() => onAddMissing(item)}
                        disabled={addingSlug === item.cardSlug}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200 active:scale-95 disabled:opacity-50"
                      >
                        {addingSlug === item.cardSlug ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add {item.missingQuantity} missing
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
