import React, { useState } from "react";
import { Upload, Loader2, FileText, Link as LinkIcon } from "lucide-react";
import type { SupportedLocale } from "@ga/contracts";
import { useTranslator } from "../hooks/useTranslator";
import { InfoTermBadge, type NomenclatureTerm } from "./InfoTermBadge";

const OMNIDEX_PLACEHOLDER = `# Material Deck
1 Spirit of Fire
1 Merlin, Memorite Vassal

# Main Deck
4 Ghosts of Pendragon
4 Stalwart Shieldmate

# Sideboard
1 Enfeebling Orb`;

export interface WantlistOmnidexGapFormProps {
  loading: boolean;
  onImportGap: (data: {
    url?: string;
    text?: string;
  }) => Promise<void>;
  locale?: SupportedLocale;
  onNavigateTerm?: (term: NomenclatureTerm) => void;
}

export const WantlistOmnidexGapForm: React.FC<WantlistOmnidexGapFormProps> = ({
  loading,
  onImportGap,
  locale,
  onNavigateTerm,
}) => {
  const t = useTranslator(locale);
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeValue = (mode === "url" ? url : text).trim();
    if (!activeValue) return;

    const isUrl =
      activeValue.startsWith("http://") || activeValue.startsWith("https://");

    await onImportGap(
      isUrl ? { url: activeValue } : { text: activeValue }
    );
    setUrl("");
    setText("");
  };

  const isDisabled =
    loading || (mode === "url" ? !url.trim() : !text.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-lg bg-black/20 border border-white/[0.04] space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span>{t("rootApp.wantlist.importGapHeading")}</span>
          <InfoTermBadge term="omnidexFormat" locale={locale} onNavigate={onNavigateTerm} />
        </h3>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition ${
              mode === "url"
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            {t("rootApp.deckForms.tabUrl")}
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition ${
              mode === "text"
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FileText className="w-3 h-3" />
            {t("rootApp.deckForms.tabText")}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        {t("rootApp.wantlist.importGapDesc")}
      </p>

      {mode === "url" ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("rootApp.deckForms.urlPlaceholder")}
            className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <button
            type="submit"
            disabled={isDisabled}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              t("rootApp.wantlist.importGapButton")
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={OMNIDEX_PLACEHOLDER}
            rows={6}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-y"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isDisabled}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                t("rootApp.wantlist.importGapButton")
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
