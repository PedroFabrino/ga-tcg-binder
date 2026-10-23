"use client";

import type { SeatId, TableState } from "@ga/contracts";
import { CardArt, PinCardLabel } from "@/components/table/card-art";
import { seatDisplayName } from "@/lib/seat-name";
import { useCardDetail } from "@/lib/use-card-catalog";
import { useTranslation } from "@/lib/i18n";

/**
 * A read-only scoreboard for the overlay and `/stage`: the same HUD facts as the
 * editable Table, with level and life read from the pinned Champion card.
 */
export function SeatScoreboard({
  table,
  seat,
  compact = false,
}: {
  table: TableState;
  seat: SeatId;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const state = table.seats[seat];
  const { detail } = useCardDetail(state?.championSlug ?? null);
  const fallback = seat === "p1" ? t("table.seat1") : t("table.seat2");
  const name = seatDisplayName(table.seats, seat, fallback);
  const damage = state?.damage ?? 0;
  const memory = state?.memory ?? 0;
  const hand = state?.hand ?? 0;

  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-white ${
        compact ? "" : "min-h-28"
      }`}
    >
      {state?.championSlug ? (
        <CardArt
          cardSlug={state.championSlug}
          className={compact ? "h-16 w-12 shrink-0" : "h-24 w-[70px] shrink-0"}
        />
      ) : (
        <div
          className={`flex shrink-0 items-center justify-center rounded-md border border-dashed border-white/20 text-[10px] text-white/50 ${
            compact ? "h-16 w-12" : "h-24 w-[70px]"
          }`}
        >
          {t("table.champion")}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{name}</span>
          {table.active === seat && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">
              {t("table.active")}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-white/60">
          {detail?.name ?? state?.championSlug ?? t("table.champion")}
        </p>
        <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]">
          <span>
            <span className="text-white/50">{t("table.level")} </span>
            {detail?.level ?? t("table.emptyValue")}
          </span>
          <span>
            <span className="text-white/50">{t("table.life")} </span>
            {detail?.life ?? t("table.emptyValue")}
          </span>
          <span>
            <span className="text-white/50">{t("table.damage")} </span>
            {damage}
          </span>
          <span>
            <span className="text-white/50">{t("table.memory")} </span>
            {memory}
          </span>
          <span>
            <span className="text-white/50">{t("table.hand")} </span>
            {hand}
          </span>
          <span>
            <span className="text-white/50">{t("table.influence")} </span>
            {memory + hand}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Both Seats' current Pins at the requested art height. */
export function TablePins({
  table,
  artClassName = "h-48 w-full",
}: {
  table: TableState;
  artClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3">
      {(["p1", "p2"] as const).map((seat) => {
        const pin = table.pins[seat];
        const fallback = seat === "p1" ? t("table.seat1") : t("table.seat2");
        return (
          <div key={seat} className="flex min-w-0 flex-col gap-1 text-white">
            <p className="truncate text-[11px] text-white/60">
              {t("table.pinBySeat", { name: seatDisplayName(table.seats, seat, fallback) })}
            </p>
            {pin ? (
              <>
                <CardArt
                  cardSlug={pin.cardSlug}
                  printingSlug={pin.printingSlug}
                  className={artClassName}
                />
                <PinCardLabel
                  cardSlug={pin.cardSlug}
                  fallback={pin.cardSlug}
                  className="truncate text-xs font-medium"
                />
              </>
            ) : (
              <p className="text-xs text-white/40">{t("table.pinNone")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The shared last-three Pin history with attribution. */
export function RecentPinStrip({ table }: { table: TableState }) {
  const { t } = useTranslation();
  const recent = table.recent.slice(0, 3);

  return (
    <div className="flex items-center gap-2 text-white">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/50">
        {t("table.pinRecent")}
      </span>
      {recent.length === 0 ? (
        <span className="text-xs text-white/40">{t("table.pinEmpty")}</span>
      ) : (
        recent.map((pin, index) => {
          const fallback = pin.seat === "p1" ? t("table.seat1") : t("table.seat2");
          return (
            <div key={`${pin.seat}-${pin.at}-${index}`} className="flex items-center gap-1">
              <CardArt
                cardSlug={pin.cardSlug}
                printingSlug={pin.printingSlug}
                className="h-12 w-9 shrink-0"
              />
              <span className="max-w-28 truncate text-[11px]">
                {t("table.pinBySeat", { name: seatDisplayName(table.seats, pin.seat, fallback) })}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
