import React, { useState } from "react";
import { Loader2, Save, FileText, Link as LinkIcon } from "lucide-react";
import type { DeckSummary } from "../types";

const OMNIDEX_PLACEHOLDER = `# Material Deck
1 Spirit of Fire
1 Merlin, Memorite Vassal

# Main Deck
4 Ghosts of Pendragon
4 Stalwart Shieldmate

# Sideboard
1 Enfeebling Orb`;

export interface DeckEditFormProps {
  deck: DeckSummary;
  onSave: (
    deckId: string,
    data: { name?: string; url?: string; text?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export const DeckEditForm: React.FC<DeckEditFormProps> = ({
  deck,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(deck.name);
  const [mode, setMode] = useState<"text" | "url">("text");
  const [text, setText] = useState(deck.omnidexText || "");
  const [url, setUrl] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const activeValue = (mode === "text" ? text : url).trim();
    const isUrl =
      activeValue.startsWith("http://") || activeValue.startsWith("https://");

    setUpdating(true);
    setError(null);
    try {
      const res = await onSave(deck.id, {
        name: name.trim(),
        text: !isUrl && activeValue ? activeValue : undefined,
        url: isUrl ? activeValue : undefined,
      });
      if (!res.success) {
        setError(res.error || "Failed to update deck");
      }
    } catch {
      setError("Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const isSaveDisabled =
    updating ||
    !name.trim() ||
    (mode === "text" && !text.trim()) ||
    (mode === "url" && !url.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-black/40 border-t border-cyan-500/30 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-cyan-300">
          Edit Deck: {deck.name}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <div>
        <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
          Deck Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deck name..."
          className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
            mode === "text"
              ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Decklist Text
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
            mode === "url"
              ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Omnidex / Silvie URL
        </button>
      </div>

      {mode === "text" ? (
        <div>
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Decklist (Material Deck, Main Deck, Sideboard)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={OMNIDEX_PLACEHOLDER}
            rows={8}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/[0.1] text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-y"
          />
        </div>
      ) : (
        <div>
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Omnidex or Silvie URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://omnidex.gg/deck/..."
            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="submit"
          disabled={isSaveDisabled}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs cursor-pointer transition"
        >
          {updating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save Changes
        </button>
      </div>
    </form>
  );
};
