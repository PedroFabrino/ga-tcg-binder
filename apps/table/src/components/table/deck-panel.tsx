"use client";

import { useEffect, useMemo, useState } from "react";
import type { CardCatalogState } from "@/lib/use-card-catalog";
import type { StoredDeck, StoredDeckEntry } from "@/lib/deck-storage";
import { useTranslation } from "@/lib/i18n";

export interface DeckPanelProps {
  deck: StoredDeck | null;
  catalog: CardCatalogState;
  onImport: (rawText: string) => Promise<void>;
  onClear: () => void;
}

function totalCards(deck: StoredDeck): number {
  return [...deck.main, ...deck.material, ...deck.side].reduce(
    (total, entry) => total + entry.quantity,
    0
  );
}

function ZoneColumn({
  title,
  entries,
  unresolvedLabel,
}: {
  title: string;
  entries: StoredDeckEntry[];
  unresolvedLabel: string;
}) {
  return (
    <div className="min-w-0">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="grid max-h-56 gap-1 overflow-auto pr-1 text-xs">
          {entries.map((entry, index) => (
            <li
              key={`${entry.name}-${index}`}
              title={entry.card ? undefined : unresolvedLabel}
              className={`flex items-start gap-1 rounded px-1 py-0.5 ${
                entry.card ? "text-foreground" : "border border-dashed border-amber-500/50 text-amber-700"
              }`}
            >
              <span className="w-6 shrink-0 font-mono text-muted-foreground">
                {entry.quantity}×
              </span>
              <span className="min-w-0 break-words">{entry.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The owner's local deck. The imported text and resolved cards stay in this
 * browser; `onImport` is the only bridge to the Table because it may set the
 * Champion in the local Seat HUD.
 */
export function DeckPanel({ deck, catalog, onImport, onClear }: DeckPanelProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(deck === null);
  const [rawText, setRawText] = useState(deck?.rawText ?? "");
  const [importing, setImporting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (deck) setEditing(false);
  }, [deck]);

  const warnings = useMemo(
    () =>
      deck
        ? deck.warnings.filter((warning) => warning.code === "unresolvedCard")
        : [],
    [deck]
  );

  const count = deck ? totalCards(deck) : 0;

  async function submit() {
    if (importing) return;
    setImporting(true);
    setFailed(false);
    try {
      await onImport(rawText);
      setEditing(false);
    } catch {
      setFailed(true);
    } finally {
      setImporting(false);
    }
  }

  function startReplace() {
    setRawText(deck?.rawText ?? "");
    setEditing(true);
    setFailed(false);
  }

  function clear() {
    onClear();
    setRawText("");
    setEditing(true);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          {t("table.deckTitle")}
        </h2>
        {deck && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {t("table.deckCards", { count })}
          </span>
        )}
      </header>

      {deck && !editing ? (
        <>
          <p className="text-xs text-muted-foreground">{t("table.deckHint")}</p>
          <div className="rounded-md bg-secondary/50 px-2 py-1 text-xs">
            {deck.champion ? (
              <span>
                {t("table.deckChampion", { name: deck.champion.name })}
              </span>
            ) : (
              <span className="text-amber-700">{t("table.deckChampionMissing")}</span>
            )}
          </div>

          {deck.warnings.some(
            (warning) => warning.code === "championAmbiguous"
          ) && deck.champion && (
            <p className="text-xs text-amber-700">
              {t("table.deckChampionAmbiguous", { name: deck.champion.name })}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <ZoneColumn
              title={t("table.deckMaterial")}
              entries={deck.material}
              unresolvedLabel={t("table.deckCardUnresolved")}
            />
            <ZoneColumn
              title={t("table.deckMain")}
              entries={deck.main}
              unresolvedLabel={t("table.deckCardUnresolved")}
            />
            <ZoneColumn
              title={t("table.deckSide")}
              entries={deck.side}
              unresolvedLabel={t("table.deckCardUnresolved")}
            />
          </div>

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              <p className="font-medium text-amber-800">
                {t("table.deckUnresolved")} ({warnings.length})
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {t("table.deckUnresolvedHint", { count: warnings.length })}
              </p>
              <ul className="mt-1 grid max-h-24 gap-0.5 overflow-auto">
                {warnings.map((warning) => (
                  <li key={warning.name} className="break-words text-amber-800">
                    {warning.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startReplace}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium"
            >
              {t("table.deckReplace")}
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive"
            >
              {t("table.deckClear")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("table.deckHint")}</p>
          {catalog.status === "loading" && (
            <p className="text-xs text-muted-foreground">{t("table.deckCatalogLoading")}</p>
          )}
          {catalog.status === "ready" && catalog.stale && (
            <p className="text-xs text-amber-700">{t("table.deckCatalogStale")}</p>
          )}
          {catalog.status === "error" && (
            <p className="text-xs text-amber-700">{t("table.deckCatalogUnavailable")}</p>
          )}
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={t("table.deckPlaceholder")}
            rows={8}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {failed && (
            <p role="alert" className="text-xs text-destructive">
              {t("table.deckImportFailed")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={importing || !rawText.trim() || catalog.status === "loading"}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {importing ? t("table.deckImporting") : t("table.deckImport")}
            </button>
            {deck && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium"
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
