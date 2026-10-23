"use client";

import { useMemo } from "react";
import type { LogEntry, SeatId, SeatState, TranslationKey } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";

const HUD_FIELDS: Record<string, TranslationKey> = {
  displayName: "table.name",
  championSlug: "table.champion",
  damage: "table.damage",
  memory: "table.memory",
  hand: "table.hand",
};

const LOG_LIMIT = 50;

export interface ActionLogProps {
  entries: LogEntry[];
  seats: Partial<Record<SeatId, SeatState>>;
}

/**
 * The append-only action log, newest first. The room already caps the history
 * at 50 entries; slicing here keeps the view honest even if a future server
 * keeps more.
 */
export function ActionLog({ entries, seats }: ActionLogProps) {
  const { t, locale } = useTranslation();
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [locale]
  );

  const visible = [...entries].slice(-LOG_LIMIT).reverse();

  function seatName(entry: LogEntry): string {
    const name = seats[entry.seat]?.displayName?.trim();
    if (name) return name;
    return entry.seat === "p1" ? t("table.seat1") : t("table.seat2");
  }

  function describe(entry: LogEntry): string {
    switch (entry.kind) {
      case "join":
        return t("table.log.joined");
      case "disconnect":
        return t("table.log.left");
      case "turn":
        return entry.detail === "start"
          ? t("table.log.turnStarted")
          : t("table.log.turnEnded");
      case "hud": {
        const fields = entry.detail
          .split(",")
          .filter(Boolean)
          .map((field) => {
            const key = HUD_FIELDS[field];
            return key ? t(key) : field;
          });
        return fields.length > 0
          ? t("table.log.hudUpdated", { fields: fields.join(", ") })
          : t("table.log.hud");
      }
      case "pin":
        return entry.detail === "cleared"
          ? t("table.log.pinCleared")
          : t("table.log.pinned", { card: entry.detail });
      case "ripple":
        return t("table.log.ripple");
      default:
        return entry.detail || entry.kind;
    }
  }

  return (
    <section
      aria-labelledby="action-log-title"
      className="rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="action-log-title" className="text-sm font-semibold">
        {t("table.log.title")}
      </h2>

      {visible.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("table.log.empty")}</p>
      ) : (
        <ol className="mt-2 max-h-64 list-none space-y-0 overflow-y-auto">
          {visible.map((entry, index) => (
            <li
              key={`${entry.at}-${entry.seat}-${entry.kind}-${index}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0"
            >
              <time
                dateTime={new Date(entry.at).toISOString()}
                className="font-mono text-xs text-muted-foreground"
              >
                {formatter.format(entry.at)}
              </time>
              <span className="text-sm font-medium">{seatName(entry)}</span>
              <span className="text-sm">{describe(entry)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
