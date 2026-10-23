"use client";

import { useEffect, useRef, useState } from "react";
import { tableInviteUrl } from "@/lib/table-links";
import { useTranslation } from "@/lib/i18n";

/**
 * The host-only invite panel. It exists only in the browser that created the
 * Table, because only that browser kept the p2 token from the create response.
 */
export function InvitePanel({ code, p2Token }: { code: string; p2Token: string }) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const inviteUrl = origin ? tableInviteUrl(origin, code, p2Token) : "";

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
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
          onClick={copy}
          className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
        >
          {copied ? t("common.copied") : t("table.copyInvite")}
        </button>
      </div>
    </section>
  );
}
