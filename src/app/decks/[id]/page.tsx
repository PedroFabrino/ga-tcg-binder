"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  Users,
  Lock,
  Unlock,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

interface ShortageItem {
  cardSlug: string;
  cardName: string;
  zone: string;
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  isContended: boolean;
  contendingDeckNames: string[];
  dedicatedCopiesOwned: number;
  sharedCopiesOwned: number;
  friendsWithIdle: {
    friendId: string;
    friendName: string;
    friendCode: string;
    idleQuantity: number;
  }[];
}

interface ShortageReport {
  deckId: string;
  deckName: string;
  totalCardsRequired: number;
  totalCardsMissing: number;
  items: ShortageItem[];
}

export default function DeckDetailPage() {
  const params = useParams();
  const deckId = params?.id as string;

  const [deck, setDeck] = useState<any>(null);
  const [cards, setCards] = useState<{ material: any[]; main: any[]; side: any[] }>({
    material: [],
    main: [],
    side: [],
  });
  const [omnidexText, setOmnidexText] = useState("");
  const [shortage, setShortage] = useState<ShortageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [addingMissingSlug, setAddingMissingSlug] = useState<string | null>(null);

  const fetchDeckAndShortage = async () => {
    setLoading(true);
    try {
      const [deckRes, shortageRes] = await Promise.all([
        fetch(`/api/decks/${deckId}`),
        fetch(`/api/decks/${deckId}/shortage`),
      ]);
      const deckData = await deckRes.json();
      const shortageData = await shortageRes.json();

      if (deckData.deck) {
        setDeck(deckData.deck);
        setCards(deckData.cards);
        setOmnidexText(deckData.omnidexText);
      }
      if (shortageData.items) {
        setShortage(shortageData);
      }
    } catch (err) {
      console.error("Failed to load deck:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (deckId) {
      fetchDeckAndShortage();
    }
  }, [deckId]);

  const handleCopyOmnidex = () => {
    navigator.clipboard.writeText(omnidexText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddMissingToCollection = async (slug: string, missingQty: number) => {
    setAddingMissingSlug(slug);
    try {
      // Find edition for this card slug
      const catRes = await fetch(`/api/catalog?query=${encodeURIComponent(slug)}&limit=1`);
      const catData = await catRes.json();
      const matchedCard = catData.cards?.[0];
      const targetEdition = matchedCard?.editions?.[0];

      if (targetEdition) {
        await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editionId: targetEdition.id,
            foil: false,
            quantity: missingQty,
          }),
        });
        fetchDeckAndShortage();
      }
    } catch (err) {
      console.error("Failed to add missing card:", err);
    } finally {
      setAddingMissingSlug(null);
    }
  };

  const mainCount = cards.main.reduce((s, c) => s + c.quantity, 0);
  const matCount = cards.material.reduce((s, c) => s + c.quantity, 0);
  const sideCount = cards.side.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <a
            href="/decks"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Decks</span>
          </a>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-3">
            <span>{deck?.name || "Deck Details"}</span>
            <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              {deck?.format?.toUpperCase() || "STANDARD"}
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Champion: <span className="text-slate-200 font-medium">{deck?.champion || "Unspecified"}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyOmnidex}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied Omnidex Text!" : "Export Omnidex"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Evaluating card availability and shortages...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Shortage Analysis & Feasibility */}
          <div className="lg:col-span-2 space-y-5">
            {/* Shortage Status Banner */}
            {shortage && (
              <div
                className={`rounded-2xl border p-5 shadow-lg ${
                  shortage.totalCardsMissing === 0
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                    : "border-amber-500/30 bg-amber-950/20 text-amber-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {shortage.totalCardsMissing === 0 ? (
                      <CheckCircle2 className="h-8 w-8 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-amber-400 flex-shrink-0" />
                    )}
                    <div>
                      <h3 className="font-bold text-base text-white">
                        {shortage.totalCardsMissing === 0
                          ? "Physical Deck Feasibility: Complete & Ready"
                          : `Physical Deck Feasibility: ${shortage.totalCardsMissing} Missing Card Copies`}
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {shortage.totalCardsMissing === 0
                          ? "All cards in this decklist are verified and satisfied by your physical collection."
                          : "Review the shortages below. You can add missing cards to your binder or borrow idle copies from playgroup friends."}
                      </p>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-2xl font-black font-mono">
                      {shortage.totalCardsRequired - shortage.totalCardsMissing} /{" "}
                      {shortage.totalCardsRequired}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Cards In Hand</div>
                  </div>
                </div>
              </div>
            )}

            {/* Shortage Items Detailed Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Card Demands & Contention Analysis</span>
                <span className="text-xs text-slate-500 font-normal">
                  Shared by default • Dedicated cards isolated
                </span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Card Name</th>
                      <th className="py-2.5 px-3">Zone</th>
                      <th className="py-2.5 px-3 text-center">Required</th>
                      <th className="py-2.5 px-3 text-center">Owned</th>
                      <th className="py-2.5 px-3">Contention & Shortage</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {shortage?.items.map((item) => (
                      <tr key={item.cardSlug} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-white text-sm">{item.cardName}</div>
                          {/* Friend idle notification if missing */}
                          {item.missingQuantity > 0 && item.friendsWithIdle.length > 0 && (
                            <div className="mt-1 flex items-center space-x-1 text-[11px] text-indigo-400 bg-indigo-950/40 border border-indigo-500/20 rounded-md px-2 py-0.5">
                              <Users className="h-3 w-3" />
                              <span>
                                Available from Friends:{" "}
                                <strong>
                                  {item.friendsWithIdle[0].friendName} ({item.friendsWithIdle[0].idleQuantity} idle)
                                </strong>
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 uppercase">
                            {item.zone}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-slate-200 font-mono">
                          {item.requiredQuantity}
                        </td>

                        <td className="py-3 px-3 text-center font-bold font-mono">
                          <span
                            className={
                              item.availableQuantity >= item.requiredQuantity
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }
                          >
                            {item.availableQuantity}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            {item.missingQuantity > 0 ? (
                              <span className="inline-flex items-center space-x-1 rounded bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                                <span>Shortage: -{item.missingQuantity}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px] font-semibold">
                                <Check className="h-3.5 w-3.5" />
                                <span>Satisfied</span>
                              </span>
                            )}

                            {/* Cross-deck contention tag */}
                            {item.isContended && (
                              <div
                                className="text-[10px] text-amber-400 flex items-center space-x-1"
                                title={`Compromised by concurrent usage in: ${item.contendingDeckNames.join(", ")}`}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                <span>
                                  Contended in {item.contendingDeckNames.length} other deck
                                  {item.contendingDeckNames.length > 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right">
                          {item.missingQuantity > 0 && (
                            <button
                              onClick={() =>
                                handleAddMissingToCollection(item.cardSlug, item.missingQuantity)
                              }
                              disabled={addingMissingSlug === item.cardSlug}
                              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                            >
                              {addingMissingSlug === item.cardSlug ? "Adding..." : "+ Add to Collection"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Col: Deck Zone Breakdown (60 Main, 12 Material, Side) */}
          <div className="space-y-5">
            {/* Zones Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Tournament Deck Composition
              </h3>

              {/* Material Deck */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-slate-800 pb-1">
                  <span>Material Deck ({matCount} / 12)</span>
                  <span className="text-[10px] text-indigo-400">Champions & Regalia</span>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1 text-xs">
                  {cards.material.map((c) => (
                    <div key={c.id} className="flex justify-between py-0.5 text-slate-300">
                      <span>{c.cardName || c.cardSlug}</span>
                      <span className="font-mono text-slate-500">x{c.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Deck */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-slate-800 pb-1">
                  <span>Main Deck ({mainCount} / 60)</span>
                  <span className="text-[10px] text-indigo-400">Attacks, Actions, Allies</span>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto pr-1 text-xs">
                  {cards.main.map((c) => (
                    <div key={c.id} className="flex justify-between py-0.5 text-slate-300">
                      <span>{c.cardName || c.cardSlug}</span>
                      <span className="font-mono text-slate-500">x{c.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sideboard */}
              {cards.side.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-slate-800 pb-1">
                    <span>Sideboard ({sideCount})</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1 text-xs">
                    {cards.side.map((c) => (
                      <div key={c.id} className="flex justify-between py-0.5 text-slate-300">
                        <span>{c.cardName || c.cardSlug}</span>
                        <span className="font-mono text-slate-500">x{c.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
