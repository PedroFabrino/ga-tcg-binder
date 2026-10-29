import React from "react";
import { Hash, AlertCircle, FolderTree } from "lucide-react";
import type { Translator } from "@ga/contracts";

export interface AdminStatusBadgesProps {
  t: Translator;
  broadcastChannelId: string;
  broadcastChannelName: string;
  alertSectionId: string;
  alertSectionName: string;
}

export const AdminStatusBadges: React.FC<AdminStatusBadgesProps> = ({
  t,
  broadcastChannelId,
  broadcastChannelName,
  alertSectionId,
  alertSectionName,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 font-medium">
          {t("communityAdmin.activeChannelLabel")}:
        </span>
        {broadcastChannelId ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-xs">
            <Hash className="w-3 h-3 text-emerald-400" />
            {broadcastChannelName || broadcastChannelId}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <AlertCircle className="w-3 h-3" />
            {t("communityAdmin.noChannelConfigured")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-400 font-medium">
          {t("communityAdmin.activeGroupLabel")}:
        </span>
        {alertSectionId ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono text-xs">
            <FolderTree className="w-3 h-3 text-sky-400" />
            {alertSectionName || alertSectionId}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-500/10 border border-white/[0.08] text-slate-400 text-xs">
            {t("communityAdmin.noGroupConfigured")}
          </span>
        )}
      </div>
    </div>
  );
};
