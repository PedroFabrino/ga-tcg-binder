"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Modal } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import type { CollectionItem } from "./types";
import {
  exportCollectionToOmnidex,
  exportCollectionToCsv,
  downloadExportFile,
} from "@/lib/collection-export";

type ExportFormat = "omnidex" | "csv";
type ExportScope = "full" | "current";

interface CollectionExportModalProps {
  onClose: () => void;
  currentItems: CollectionItem[];
  userId?: string | null;
  activeTabTitle?: string;
  isFiltered?: boolean;
}

export default function CollectionExportModal({
  onClose,
  currentItems,
  userId,
  activeTabTitle,
  isFiltered,
}: CollectionExportModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [format, setFormat] = useState<ExportFormat>("omnidex");
  const [scope, setScope] = useState<ExportScope>("full");
  const [includePrintings, setIncludePrintings] = useState(true);
  const [fullItems, setFullItems] = useState<CollectionItem[] | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [copied, setCopied] = useState(false);

  // If full collection is needed and not already available in currentItems
  useEffect(() => {
    let active = true;
    async function loadFull() {
      setLoadingFull(true);
      try {
        const userQuery = userId ? `&userId=${encodeURIComponent(userId)}` : "";
        const res = await fetch(`/api/collection?view=ALL${userQuery}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (active && Array.isArray(data.items)) {
          setFullItems(data.items);
        }
      } catch {
        // Fallback to current items if request fails
        if (active) setFullItems(currentItems);
      } finally {
        if (active) setLoadingFull(false);
      }
    }

    loadFull();

    return () => {
      active = false;
    };
  }, [userId, currentItems]);

  const targetItems = useMemo(() => {
    if (scope === "current") return currentItems;
    return fullItems || currentItems;
  }, [scope, fullItems, currentItems]);

  const totalCopies = useMemo(
    () => targetItems.reduce((acc, item) => acc + item.quantity, 0),
    [targetItems]
  );

  const fullCopies = useMemo(() => {
    const list = fullItems || currentItems;
    return list.reduce((acc, item) => acc + item.quantity, 0);
  }, [fullItems, currentItems]);

  const currentCopies = useMemo(
    () => currentItems.reduce((acc, item) => acc + item.quantity, 0),
    [currentItems]
  );

  const exportedText = useMemo(() => {
    if (format === "omnidex") {
      return exportCollectionToOmnidex(targetItems, { includePrintings });
    }
    return exportCollectionToCsv(targetItems);
  }, [format, targetItems, includePrintings]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedText);
      setCopied(true);
      showToast(t("collection.exportCopiedToast"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("common.error"), "error");
    }
  };

  const handleDownload = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    if (format === "omnidex") {
      downloadExportFile(
        exportedText,
        `grand-archive-collection-${dateStr}.txt`,
        "text/plain;charset=utf-8"
      );
    } else {
      downloadExportFile(
        exportedText,
        `grand-archive-collection-${dateStr}.csv`,
        "text/csv;charset=utf-8"
      );
    }
    showToast(t("common.success"), "success");
  };

  const canShowScopeSwitch = isFiltered || currentItems.length !== (fullItems?.length ?? currentItems.length);

  return (
    <Modal
      title={t("collection.exportModalTitle")}
      subtitle={t("collection.exportModalSubtitle")}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose} variant="outline">
            {t("common.close")}
          </Button>
          <Button onClick={handleCopy} variant="outline" disabled={targetItems.length === 0}>
            {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
            {t("collection.exportCopyBtn")}
          </Button>
          <Button onClick={handleDownload} disabled={targetItems.length === 0}>
            <Download className="h-4 w-4" />
            {t("collection.exportDownloadBtn", {
              format: format === "omnidex" ? ".TXT" : ".CSV",
            })}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Format & Scope Selector */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-4">
          {/* Format Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">{t("collection.exportFormatLabel")}</span>
            <div className="inline-flex rounded-lg border border-white/[0.08] bg-slate-900/60 p-0.5">
              <button
                type="button"
                onClick={() => setFormat("omnidex")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  format === "omnidex"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{t("collection.exportFormatOmnidex")}</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  format === "csv"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>{t("collection.exportFormatCsv")}</span>
              </button>
            </div>
          </div>

          {/* Scope Switcher if current view is filtered */}
          {canShowScopeSwitch && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">{t("collection.exportScopeLabel")}</span>
              <div className="inline-flex rounded-lg border border-white/[0.08] bg-slate-900/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setScope("full")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    scope === "full"
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {loadingFull ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  <span>{t("collection.exportScopeFull", { count: fullCopies })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope("current")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    scope === "current"
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>{t("collection.exportScopeFiltered", { count: currentCopies })}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Omnidex Options */}
        {format === "omnidex" && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
            <input
              type="checkbox"
              checked={includePrintings}
              onChange={(e) => setIncludePrintings(e.target.checked)}
              className="rounded border-white/[0.2] bg-slate-900 text-cyan-500 focus:ring-0"
            />
            <span>{t("collection.exportDetailedOmnidex")}</span>
          </label>
        )}

        {/* Content Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps">
              {t("collection.exportPreviewSummary", {
                copies: totalCopies,
                printings: targetItems.length,
              })}
            </span>
            {loadingFull && (
              <span className="flex items-center gap-1 text-[11px] text-cyan-300">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("collection.exportLoadingFull")}
              </span>
            )}
          </div>

          {targetItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center text-xs text-slate-500">
              {t("collection.exportEmptyMessage")}
            </p>
          ) : (
            <textarea
              readOnly
              rows={12}
              value={exportedText}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/40 p-3 font-mono text-xs leading-relaxed text-slate-200 focus:outline-none"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
