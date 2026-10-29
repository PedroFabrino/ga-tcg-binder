import React from "react";
import { Languages } from "lucide-react";
import type { SupportedLocale, Translator } from "@ga/contracts";

export interface AdminBroadcastLanguageSelectorProps {
  t: Translator;
  broadcastLocale: SupportedLocale;
  disabled: boolean;
  onSaveLocale: (locale: SupportedLocale) => void;
}

export const AdminBroadcastLanguageSelector: React.FC<
  AdminBroadcastLanguageSelectorProps
> = ({ t, broadcastLocale, disabled, onSaveLocale }) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06] text-xs">
      <div className="flex items-center gap-2 text-slate-300 font-medium">
        <Languages className="w-4 h-4 text-amber-400" />
        <span>{t("communityAdmin.broadcastLocaleLabel")}:</span>
      </div>
      <div className="relative w-full sm:w-auto min-w-[200px]">
        <select
          aria-label={t("communityAdmin.broadcastLocaleLabel")}
          value={broadcastLocale}
          onChange={(e) =>
            onSaveLocale(e.target.value === "pt-BR" ? "pt-BR" : "en")
          }
          disabled={disabled}
          className="w-full appearance-none rounded-lg border border-white/[0.12] bg-black/40 px-3.5 py-2 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
        >
          <option value="en">{t("communityAdmin.broadcastLocaleEn")}</option>
          <option value="pt-BR">{t("communityAdmin.broadcastLocalePtBr")}</option>
        </select>
      </div>
    </div>
  );
};
