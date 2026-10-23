"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { TranslationKey } from "@ga/contracts";
import { createTable } from "@/lib/create-table";
import { useTranslation } from "@/lib/i18n";
import { saveTableInvite } from "@/lib/table-invite";
import { parseTableCode, tableSeatPath } from "@/lib/table-links";
import {
  browserStorage,
  readStoredSeatSession,
  saveSeatSession,
} from "@/lib/table-session";

export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [joinError, setJoinError] = useState<TranslationKey | null>(null);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setCreateFailed(false);
    try {
      const credentials = await createTable();
      saveSeatSession(
        credentials.code,
        { seat: "p1", token: credentials.p1Token },
        browserStorage()
      );
      saveTableInvite(
        credentials.code,
        { p2Token: credentials.p2Token, viewerToken: credentials.viewerToken },
        browserStorage()
      );
      router.push(tableSeatPath(credentials.code, "p1", credentials.p1Token));
    } catch {
      setCreateFailed(true);
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = parseTableCode(codeInput);
    if (!code) {
      setJoinError("table.joinInvalidCode");
      return;
    }
    const stored = readStoredSeatSession(code, browserStorage());
    if (!stored) {
      setJoinError("table.joinNoSeat");
      return;
    }
    setJoinError(null);
    router.push(`/t/${code}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">{t("table.title")}</h1>
        <p className="text-muted-foreground">{t("table.tagline")}</p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <section className="space-y-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            aria-busy={creating}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? t("table.creating") : t("table.createTable")}
          </button>
          <p className="text-xs text-muted-foreground">{t("table.joinHint")}</p>
          {createFailed && (
            <p role="alert" className="text-sm text-destructive">
              {t("table.createFailed")}
            </p>
          )}
        </section>

        <form
          onSubmit={handleJoin}
          className="space-y-2 border-t border-border pt-6 text-left"
        >
          <h2 className="text-sm font-semibold">{t("table.joinTitle")}</h2>
          <label htmlFor="room-code" className="block text-xs text-muted-foreground">
            {t("table.roomCode")}
          </label>
          <div className="flex gap-2">
            <input
              id="room-code"
              value={codeInput}
              onChange={(event) => {
                setCodeInput(event.target.value);
                setJoinError(null);
              }}
              placeholder={t("table.roomCodePlaceholder")}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-wider outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
            >
              {t("table.join")}
            </button>
          </div>
          {joinError && (
            <p role="alert" className="text-sm text-destructive">
              {t(joinError)}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
