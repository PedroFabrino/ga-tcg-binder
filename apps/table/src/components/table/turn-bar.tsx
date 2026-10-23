"use client";

import type { SeatId, SeatState } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";

export interface TurnBarProps {
  active: SeatId | null;
  seat: SeatId;
  seats: Partial<Record<SeatId, SeatState>>;
  canAct: boolean;
  pending: boolean;
  onStart: () => void;
  onEnd: () => void;
}

/**
 * The table-wide Turn control. Any Seat can open a turn while none is active;
 * only the active Seat gets the End action. The server enforces the same rules
 * from the socket's token, so this is a mirror, not the authority.
 */
export function TurnBar({
  active,
  seat,
  seats,
  canAct,
  pending,
  onStart,
  onEnd,
}: TurnBarProps) {
  const { t } = useTranslation();
  const activeName = active
    ? seats[active]?.displayName || (active === "p1" ? t("table.seat1") : t("table.seat2"))
    : null;

  const buttonClass =
    "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground " +
    "disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section
      aria-labelledby="turn-title"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div>
        <h2
          id="turn-title"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("table.turn")}
        </h2>
        <p className="mt-1 text-sm">
          {activeName
            ? t("table.turnActive", { name: activeName })
            : t("table.turnNone")}
        </p>
      </div>

      {active === null && (
        <button
          type="button"
          onClick={onStart}
          disabled={!canAct || pending}
          aria-busy={pending}
          className={buttonClass}
        >
          {t("table.startTurn")}
        </button>
      )}

      {active === seat && (
        <button
          type="button"
          onClick={onEnd}
          disabled={!canAct || pending}
          aria-busy={pending}
          className={buttonClass}
        >
          {t("table.endTurn")}
        </button>
      )}
    </section>
  );
}
