import React, { useState } from "react";
import { Loader2, Plus, FileText, Link as LinkIcon, X } from "lucide-react";

const OMNIDEX_PLACEHOLDER = `# Material Deck
1 Spirit of Fire
1 Merlin, Memorite Vassal

# Main Deck
4 Ghosts of Pendragon
4 Stalwart Shieldmate

# Sideboard
1 Enfeebling Orb`;

export interface DeckImportFormProps {
  onImport: (
    data: { url?: string; text?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

export const DeckImportForm: React.FC<DeckImportFormProps> = ({
  onImport,
  onClose,
}) => {
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "url" && !url.trim()) return;
    if (mode === "text" && !text.trim()) return;

    setImporting(true);
    setError(null);
    try {
      const res = await onImport({
        url: mode === "url" ? url.trim() : undefined,
        text: mode === "text" ? text.trim() : undefined,
      });
      if (res.success) {
        setUrl("");
        setText("");
        onClose();
      } else {
        setError(res.error || "Failed to import deck");
      }
    } catch {
      setError("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const isImportDisabled =
    importing ||
    (mode === "url" && !url.trim()) ||
    (mode === "text" && !text.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 p-4 rounded-lg bg-black/30 border border-indigo-500/20 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
              mode === "url"
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Deck URL
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
              mode === "text"
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Paste Decklist Text
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          aria-label="Close import"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {mode === "url" ? (
        <div>
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Omnidex.gg or Silvie.gg Deck URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://omnidex.gg/deck/..."
            className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      ) : (
        <div>
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Decklist (Material Deck, Main Deck, Sideboard)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={OMNIDEX_PLACEHOLDER}
            rows={6}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50 resize-y"
          />
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="submit"
          disabled={isImportDisabled}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs cursor-pointer transition"
        >
          {importing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Import
        </button>
      </div>
    </form>
  );
};
