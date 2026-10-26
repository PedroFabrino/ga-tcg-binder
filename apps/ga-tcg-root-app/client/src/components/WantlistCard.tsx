import React, { useState, useEffect, useRef } from "react";
import {
  Heart,
  Plus,
  Trash2,
  Minus,
  Sparkles,
  Search,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type {
  IAssistantRpcClient,
  PersonalWantRpcItem,
  AutocompleteChoiceItem,
} from "../types";

export interface WantlistCardProps {
  isLinked: boolean;
  client: IAssistantRpcClient;
}

export const WantlistCard: React.FC<WantlistCardProps> = ({ isLinked, client }) => {
  const [wants, setWants] = useState<PersonalWantRpcItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteChoiceItem[]>([]);
  const [selectedCard, setSelectedCard] = useState<AutocompleteChoiceItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [foil, setFoil] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [omnidexUrl, setOmnidexUrl] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWants = async () => {
    if (!isLinked) return;
    try {
      setLoading(true);
      const res = await client.getPersonalWants();
      setWants(res.wants || []);
    } catch (err) {
      console.warn("Failed to fetch personal wants:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWants();
  }, [isLinked]);

  // Debounced catalog search for card additions
  useEffect(() => {
    if (!searchQuery.trim() || selectedCard?.name === searchQuery) {
      setSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await client.autocomplete({ type: "card", query: searchQuery.trim() });
        setSuggestions(res.results || []);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, selectedCard]);

  const handleSelectCard = (item: AutocompleteChoiceItem) => {
    setSelectedCard(item);
    setSearchQuery(item.name);
    setSuggestions([]);
  };

  const handleAddWant = async (e: React.FormEvent) => {
    e.preventDefault();
    const cardName = selectedCard?.name || searchQuery.trim();
    if (!cardName) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await client.addWant({
        card: cardName,
        quantity,
        foil,
        omnidexUrl: "",
      });

      if (res.success) {
        setFeedback({ type: "success", text: `Added ${cardName} x${quantity} to wishlist` });
        setSearchQuery("");
        setSelectedCard(null);
        setQuantity(1);
        setFoil(false);
        await fetchWants();
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to add card" });
      }
    } catch {
      setFeedback({ type: "error", text: "Error communicating with service" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (cardSlug: string, qty?: number) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await client.removeWant({ card: cardSlug, quantity: qty });
      if (res.success) {
        setFeedback({
          type: "success",
          text: res.removed ? `Removed ${res.cardName}` : `Decremented ${res.cardName}`,
        });
        await fetchWants();
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to remove card from wishlist" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportOmnidex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!omnidexUrl.trim()) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await client.addWant({
        card: "",
        quantity: 0,
        foil: false,
        omnidexUrl: omnidexUrl.trim(),
      });

      if (res.success) {
        setFeedback({ type: "success", text: "Imported shortage gap from Omnidex into wishlist!" });
        setOmnidexUrl("");
        await fetchWants();
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to import Omnidex deck" });
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to fetch or parse Omnidex deck" });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isLinked) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm shadow-xl transition-all space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Personal Wishlist & Wants</h2>
            <p className="text-xs text-slate-400">
              Manage individual wanted cards and Omnidex shortage gaps
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
          {wants.length} Wanted
        </span>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Add Card with Autocomplete */}
      <div className="space-y-3 p-4 rounded-lg bg-black/20 border border-white/[0.04]">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-pink-400" />
          Add Card to Wishlist (with Autocomplete)
        </h3>

        <form onSubmit={handleAddWant} className="space-y-3">
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedCard(null);
                }}
                placeholder="Search card name (e.g. Fireball, Fracturize)..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full rounded-lg bg-[#0d1424] border border-white/[0.12] shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                {suggestions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelectCard(item)}
                    className="w-full text-left px-3.5 py-2 hover:bg-white/[0.06] flex items-center justify-between text-xs transition cursor-pointer border-b border-white/[0.02]"
                  >
                    <span className="font-medium text-slate-200">{item.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase bg-white/[0.05] px-1.5 py-0.5 rounded">
                      {item.element || "NORM"} • {item.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Qty:</label>
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-center text-slate-200"
              />
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={foil}
                onChange={(e) => setFoil(e.target.checked)}
                className="rounded border-white/[0.2] bg-black/40 text-pink-500 focus:ring-0"
              />
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Prefer Foil
            </label>

            <button
              type="submit"
              disabled={actionLoading || !searchQuery.trim()}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add to Wishlist
            </button>
          </div>
        </form>
      </div>

      {/* Import Omnidex Gap */}
      <form onSubmit={handleImportOmnidex} className="p-4 rounded-lg bg-black/20 border border-white/[0.04] space-y-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          Import Omnidex Shortage Gap
        </h3>
        <p className="text-[11px] text-slate-400">
          Paste an Omnidex deck URL. Only cards you do not currently own in your binder will be added to your wishlist.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={omnidexUrl}
            onChange={(e) => setOmnidexUrl(e.target.value)}
            placeholder="https://omnidex.gg/deck/..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-slate-200 placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={actionLoading || !omnidexUrl.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer"
          >
            Import Gap
          </button>
        </div>
      </form>

      {/* Wishlist Items List */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Current Wishlist Items</h3>
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-500">Loading wishlist...</div>
        ) : wants.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-white/[0.08] rounded-lg">
            No personal wants recorded. Use the search bar above to add cards!
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {wants.map((w) => (
              <div
                key={w.cardSlug}
                className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/[0.04] text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200">{w.cardName}</span>
                  {w.foil && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded">
                      ★ Foil
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1 rounded">
                    x{w.desiredQuantity} wanted
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRemove(w.cardSlug, 1)}
                    disabled={actionLoading}
                    title="Decrement by 1"
                    className="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(w.cardSlug)}
                    disabled={actionLoading}
                    title="Remove entire entry"
                    className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
