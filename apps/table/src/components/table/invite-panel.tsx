"use client";

import { useEffect, useRef, useState } from "react";
import { tableInviteUrl, tableOverlayUrl } from "@/lib/table-links";
import { useTranslation } from "@/lib/i18n";

/**
 * The host-only invite panel. It exists only in the browser that created the
 * Table, because only that browser kept the p2 and viewer tokens.
 */
export function InvitePanel({
  code,
  p2Token,
  viewerToken,
}: {
  code: string;
  p2Token: string;
  viewerToken: string;
}) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"invite" | "overlay" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const inviteUrl = origin ? tableInviteUrl(origin, code, p2Token) : "";
  const overlayUrl = origin ? tableOverlayUrl(origin, code, viewerToken) : "";

  async function copy(url: string, kind: "invite" | "overlay") {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  if (!inviteUrl) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{t("table.inviteTitle")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("table.inviteHint")}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          readOnly
          value={inviteUrl}
          aria-label={t("table.inviteLink")}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => copy(inviteUrl, "invite")}
          className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
        >
          {copied === "invite" ? t("common.copied") : t("table.copyInvite")}
        </button>
      </div>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        {t("table.overlayLink")}
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={overlayUrl}
          aria-label={t("table.overlayLink")}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => copy(overlayUrl, "overlay")}
          className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
        >
          {copied === "overlay" ? t("common.copied") : t("table.copyOverlayLink")}
        </button>
      </div>
    </section>
  );
}
