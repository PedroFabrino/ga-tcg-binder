"use client";

import { useEffect, useMemo, useState } from "react";
import type { Pin, SeatId, TableState } from "@ga/contracts";
import { CardArt, PinCardLabel } from "@/components/table/card-art";
import { searchCardNames, type CardName } from "@/lib/card-catalog";
import { searchDeck, type StoredDeck } from "@/lib/deck-storage";
import { seatDisplayName } from "@/lib/seat-name";
import { useCardDetail, type CardCatalogState } from "@/lib/use-card-catalog";
import { useTranslation } from "@/lib/i18n";

export interface PinPanelProps {
  table: TableState;
  seat: SeatId;
  deck: StoredDeck | null;
  catalog: CardCatalogState;
  canAct: boolean;
  onPin: (cardSlug: string, printingSlug?: string) => void;
  onClear: () => void;
}

function SeatPin({
  seat,
  pin,
  table,
  isOwn,
  onClear,
}: {
  seat: SeatId;
  pin: Pin | undefined;
  table: TableState;
  isOwn: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const fallback = seat === "p1" ? t("table.seat1") : t("table.seat2");
  const name = seatDisplayName(table.seats, seat, fallback);

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold">{t("table.pinBySeat", { name })}</h3>
        {isOwn && pin && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-destructive/40 px-2 py-0.5 text-[10px] font-medium text-destructive"
          >
            {t("table.pinClear")}
          </button>
        )}
      </div>
      {pin ? (
        <>
          <CardArt
            cardSlug={pin.cardSlug}
            printingSlug={pin.printingSlug}
            className="h-48 w-full"
          />
          <PinCardLabel
            cardSlug={pin.cardSlug}
            fallback={pin.cardSlug}
            className="break-words text-xs font-medium"
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("table.pinNone")}</p>
      )}
    </div>
  );
}

function RecentPins({ table }: { table: TableState }) {
  const { t } = useTranslation();
  const recent = table.recent.slice(0, 3);

  return (
    <div className="grid gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("table.pinRecent")}
      </h3>
      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("table.pinEmpty")}</p>
      ) : (
        <ul className="grid gap-1">
          {recent.map((pin, index) => (
            <li
              key={`${pin.seat}-${pin.at}-${pin.cardSlug}-${index}`}
              className="flex min-w-0 items-center gap-2 rounded-md bg-secondary/40 p-1"
            >
              <CardArt
                cardSlug={pin.cardSlug}
                printingSlug={pin.printingSlug}
                className="h-16 w-12 shrink-0"
              />
              <div className="min-w-0">
                <PinCardLabel
                  cardSlug={pin.cardSlug}
                  fallback={pin.cardSlug}
                  className="block break-words text-xs font-medium"
                />
                <span className="text-[10px] text-muted-foreground">
                  {t("table.pinBySeat", {
                    name: seatDisplayName(
                      table.seats,
                      pin.seat,
                      pin.seat === "p1" ? t("table.seat1") : t("table.seat2")
                    ),
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PinSelection({
  card,
  canAct,
  onPin,
  onCancel,
}: {
  card: CardName;
  canAct: boolean;
  onPin: (cardSlug: string, printingSlug?: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { detail, loading } = useCardDetail(card.slug);
  // Undefined means the canonical Pin: no printing is stored, and the default
  // art is rendered. Choosing an edition stores only that explicit choice.
  const [printingSlug, setPrintingSlug] = useState<string | undefined>(undefined);

  return (
    <div className="grid gap-2 rounded-md border border-primary/40 bg-primary/5 p-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold">{detail?.name ?? card.name}</p>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground underline">
          {t("common.cancel")}
        </button>
      </div>
      <CardArt
        cardSlug={card.slug}
        printingSlug={printingSlug}
        name={card.name}
        className="mx-auto h-48 w-36"
      />
      {loading && <p className="text-xs text-muted-foreground">{t("table.pinLoading")}</p>}
      {!loading && !detail && (
        <p className="text-xs text-amber-700">{t("table.pinCardUnavailable")}</p>
      )}
      {detail && detail.editions.length > 0 && (
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t("table.pinPrinting")}</span>
          <select
            value={printingSlug ?? ""}
            onChange={(event) => setPrintingSlug(event.target.value || undefined)}
            className="rounded-md border border-input bg-background px-2 py-1 text-foreground"
          >
            <option value="">{t("table.pinDefaultPrinting")}</option>
            {detail.editions.map((printing) => (
              <option key={printing.slug} value={printing.slug}>
                {[printing.setPrefix, printing.collectorNumber].filter(Boolean).join(" ") ||
                  t("table.pinDefaultPrinting")}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={() => onPin(card.slug, printingSlug)}
        disabled={!canAct}
        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {t("table.pinSet")}
      </button>
    </div>
  );
}

/**
 * Search is list-first: the imported deck is the primary corpus, with an
 * explicit all-catalog fallback. Pins themselves come back from the server's
 * broadcast, so both Seats (and the overlay) see the same card.
 */
export function PinPanel({ table, seat, deck, catalog, canAct, onPin, onClear }: PinPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"deck" | "global">(deck ? "deck" : "global");
  const [selected, setSelected] = useState<CardName | null>(null);

  useEffect(() => {
    setScope(deck ? "deck" : "global");
  }, [deck]);

  const deckMatches = useMemo(
    () =>
      searchDeck(deck, query, 30).flatMap((entry) =>
        entry.card ? [{ ...entry, card: entry.card }] : []
      ),
    [deck, query]
  );
  const globalMatches = useMemo(
    () => (scope === "global" ? searchCardNames(catalog.cards, query, 20) : []),
    [catalog.cards, query, scope]
  );

  const otherSeat: SeatId = seat === "p1" ? "p2" : "p1";

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{t("table.pinTitle")}</h2>
        <div className="flex rounded-md border border-border p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setScope("deck")}
            disabled={!deck}
            aria-pressed={scope === "deck"}
            className={`rounded px-2 py-0.5 disabled:opacity-40 ${
              scope === "deck" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t("table.pinSearchDeck")}
          </button>
          <button
            type="button"
            onClick={() => setScope("global")}
            aria-pressed={scope === "global"}
            className={`rounded px-2 py-0.5 ${
              scope === "global" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t("table.pinSearchAll")}
          </button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">{t("table.pinHint")}</p>

      {!deck && (
        <p className="text-xs text-amber-700">
          {t("table.pinDeckMissing")}{" "}
          <button
            type="button"
            onClick={() => setScope("global")}
            className="underline"
          >
            {t("table.pinSearchAll")}
          </button>
        </p>
      )}

      {scope === "global" && catalog.status === "loading" && (
        <p className="text-xs text-muted-foreground">{t("table.deckCatalogLoading")}</p>
      )}
      {scope === "global" && catalog.status === "error" && (
        <p className="text-xs text-amber-700">{t("table.deckCatalogUnavailable")}</p>
      )}
      {scope === "global" && catalog.status === "ready" && catalog.stale && (
        <p className="text-xs text-amber-700">{t("table.deckCatalogStale")}</p>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("table.pinSearchPlaceholder")}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {scope === "deck" ? (
        deckMatches.length > 0 ? (
          <ul className="grid max-h-40 gap-1 overflow-auto">
            {deckMatches.map((entry) => (
              <li key={entry.card.slug}>
                <button
                  type="button"
                  onClick={() => setSelected({ name: entry.name, slug: entry.card.slug })}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-secondary"
                >
                  <span className="min-w-0 break-words">{entry.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {t("table.quantity", { count: entry.quantity })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() ? (
          <div className="grid gap-1 text-xs">
            <p className="text-muted-foreground">{t("table.pinNoDeckMatches")}</p>
            <button
              type="button"
              onClick={() => setScope("global")}
              className="justify-self-start rounded-md border border-border px-2 py-1 font-medium"
            >
              {t("table.pinSearchAll")}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("table.pinNoResults")}</p>
        )
      ) : query.trim() && globalMatches.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("table.pinNoResults")}</p>
      ) : (
        <ul className="grid max-h-40 gap-1 overflow-auto">
          {globalMatches.map((card) => (
            <li key={card.slug}>
              <button
                type="button"
                onClick={() => setSelected(card)}
                className="w-full rounded-md px-2 py-1 text-left text-xs hover:bg-secondary"
              >
                {card.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <PinSelection
          key={selected.slug}
          card={selected}
          canAct={canAct}
          onPin={(cardSlug, printingSlug) => {
            onPin(cardSlug, printingSlug);
            setSelected(null);
          }}
          onCancel={() => setSelected(null)}
        />
      )}

      <div className="grid gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("table.pinTableTitle")}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <SeatPin
            seat={seat}
            pin={table.pins[seat]}
            table={table}
            isOwn
            onClear={onClear}
          />
          <SeatPin
            seat={otherSeat}
            pin={table.pins[otherSeat]}
            table={table}
            isOwn={false}
            onClear={onClear}
          />
        </div>
      </div>

      <RecentPins table={table} />
    </section>
  );
}
