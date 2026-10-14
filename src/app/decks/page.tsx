"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Plus,
  Upload,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  X,
  Loader2,
} from "lucide-react";

interface DeckSummary {
  id: string;
  name: string;
  champion: string;
  format: string;
  mainCount: number;
  materialCount: number;
  sideCount: number;
  totalCards: number;
}

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [champion, setChampion] = useState("");
  const [omnidexText, setOmnidexText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchDecks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decks");
      const data = await res.json();
      setDecks(data.decks || []);
    } catch (err) {
      console.error("Failed to load decks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleCreateDeck = async () => {
    if (!deckName.trim()) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deckName.trim(),
          champion: champion.trim(),
        }),
      });
      const data = await res.json();
      if (data.id) {
        setShowCreateModal(false);
        setDeckName("");
        setChampion("");
        fetchDecks();
      } else {
        setErrorMsg(data.error || "Failed to create deck");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportOmnidex = async () => {
    if (!deckName.trim() || !omnidexText.trim()) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deckName.trim(),
          champion: champion.trim(),
          omnidexText,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setShowImportModal(false);
        setDeckName("");
        setChampion("");
        setOmnidexText("");
        fetchDecks();
      } else {
        setErrorMsg(data.error || "Failed to import deck");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDeck = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this deck?")) return;
    try {
      await fetch(`/api/decks/${id}`, { method: "DELETE" });
      fetchDecks();
    } catch (err) {
      console.error("Delete deck error:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Decks & Shortage Analysis</span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
              {decks.length} Decks
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Construct tournament decks and inspect physical collection shortages under Shared and Dedicated rules.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setDeckName("");
              setChampion("");
              setOmnidexText("");
              setErrorMsg("");
              setShowImportModal(true);
            }}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Upload className="h-4 w-4 text-indigo-400" />
            <span>Import Omnidex Deck</span>
          </button>

          <button
            onClick={() => {
              setDeckName("");
              setChampion("");
              setErrorMsg("");
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Deck</span>
          </button>
        </div>
      </div>

      {/* Decks Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Loading decks...</p>
        </div>
      ) : decks.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-slate-400 text-sm">No personal decks created yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Create an empty deck or paste an Omnidex decklist from Silvie.gg or GrandArchiveStats.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {decks.map((deck) => (
            <a
              key={deck.id}
              href={`/decks/${deck.id}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-5 hover:border-indigo-500/50 hover:bg-slate-900 transition-all shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/30">
                    {deck.format.toUpperCase()}
                  </span>
                  <button
                    onClick={(e) => handleDeleteDeck(deck.id, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete deck"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors">
                  {deck.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Champion: <span className="text-slate-200">{deck.champion || "Unspecified"}</span>
                </p>

                {/* Zones Summary */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
                  <div className="rounded-lg bg-slate-950 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Main
                    </div>
                    <div className="text-sm font-bold text-slate-200 font-mono">
                      {deck.mainCount} / 60
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Material
                    </div>
                    <div className="text-sm font-bold text-slate-200 font-mono">
                      {deck.materialCount} / 12
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Side
                    </div>
                    <div className="text-sm font-bold text-slate-200 font-mono">
                      {deck.sideCount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                <span>View Shortage & Card Allocation</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Create Deck Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">Create New Deck</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Deck Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lorraine Blade Master Tournament"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Champion Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lorraine, Wandering Warrior"
                  value={champion}
                  onChange={(e) => setChampion(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {errorMsg && <div className="text-xs text-rose-400 font-medium">{errorMsg}</div>}

              <button
                onClick={handleCreateDeck}
                disabled={submitting || !deckName.trim()}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>{submitting ? "Creating Deck..." : "Create Deck"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Omnidex Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Omnidex Decklist</h2>
                <p className="text-xs text-slate-400">
                  Paste decklist text from Silvie.gg, Omnidex, or GrandArchiveStats.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Deck Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Silvie Wind Aggro"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Champion (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Silvie, Withering Witch"
                    value={champion}
                    onChange={(e) => setChampion(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Omnidex Text Decklist
                </label>
                <textarea
                  rows={8}
                  placeholder={`# Material Deck
1 Starter Water
1 Lorraine, Wandering Warrior

# Main Deck
4 Fracturize
4 Arcane Disposition
4 Resplendent Bolt

# Sideboard
2 Dispel`}
                  value={omnidexText}
                  onChange={(e) => setOmnidexText(e.target.value)}
                  className="w-full font-mono text-xs rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {errorMsg && <div className="text-xs text-rose-400 font-medium">{errorMsg}</div>}

              <button
                onClick={handleImportOmnidex}
                disabled={submitting || !deckName.trim() || !omnidexText.trim()}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>{submitting ? "Importing Deck..." : "Import and Analyze Shortage"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
