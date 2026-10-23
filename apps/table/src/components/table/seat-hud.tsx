"use client";

import type { ChangeEvent } from "react";
import type { SeatId, SeatState } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";

export interface SeatHudProps {
  seat: SeatId;
  state: SeatState | undefined;
  isOwn: boolean;
  editable: boolean;
  active: boolean;
  onEdit: (patch: Partial<SeatState>) => void;
}

/**
 * One Seat's mirrored HUD. The owner edits their own panel; the other panel is
 * the same component with `editable={false}`, so no input can change the wrong
 * Seat. The server still enforces ownership from the token.
 */
export function SeatHud({ seat, state, isOwn, editable, active, onEdit }: SeatHudProps) {
  const { t } = useTranslation();
  const seatLabel = seat === "p1" ? t("table.seat1") : t("table.seat2");

  if (!state) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{seatLabel}</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {isOwn ? t("common.loading") : t("table.waitingForOpponent")}
          </span>
        </header>
      </section>
    );
  }

  const edit = (patch: Partial<SeatState>) => {
    if (editable) onEdit(patch);
  };

  const onNumber = (field: "damage" | "memory" | "hand") => (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const parsed = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(parsed)) return;
    edit({ [field]: Math.max(0, Math.trunc(parsed)) });
  };

  const inputClass =
    "w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground " +
    "read-only:border-transparent read-only:bg-secondary/60 read-only:text-muted-foreground " +
    "focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <section
      className={`rounded-lg border bg-card p-4 text-card-foreground ${
        active ? "border-primary/60" : "border-border"
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{seatLabel}</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {isOwn ? t("table.you") : t("table.opponent")}
          </span>
        </div>
        {active && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {t("table.active")}
          </span>
        )}
      </header>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-1">
          <label htmlFor={`${seat}-name`} className="text-xs font-medium text-muted-foreground">
            {t("table.name")}
          </label>
          <input
            id={`${seat}-name`}
            value={state.displayName}
            readOnly={!editable}
            aria-readonly={!editable}
            onChange={(event) => edit({ displayName: event.target.value })}
            className={inputClass}
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor={`${seat}-champion`} className="text-xs font-medium text-muted-foreground">
            {t("table.champion")}
          </label>
          <input
            id={`${seat}-champion`}
            value={state.championSlug ?? ""}
            placeholder={t("table.championPlaceholder")}
            readOnly={!editable}
            aria-readonly={!editable}
            onChange={(event) =>
              edit({ championSlug: event.target.value === "" ? null : event.target.value })
            }
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="grid gap-1">
            <label htmlFor={`${seat}-damage`} className="text-xs font-medium text-muted-foreground">
              {t("table.damage")}
            </label>
            <input
              id={`${seat}-damage`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={state.damage}
              readOnly={!editable}
              aria-readonly={!editable}
              onChange={onNumber("damage")}
              className={inputClass}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${seat}-memory`} className="text-xs font-medium text-muted-foreground">
              {t("table.memory")}
            </label>
            <input
              id={`${seat}-memory`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={state.memory}
              readOnly={!editable}
              aria-readonly={!editable}
              onChange={onNumber("memory")}
              className={inputClass}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${seat}-hand`} className="text-xs font-medium text-muted-foreground">
              {t("table.hand")}
            </label>
            <input
              id={`${seat}-hand`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={state.hand}
              readOnly={!editable}
              aria-readonly={!editable}
              onChange={onNumber("hand")}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md bg-secondary/60 px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground">{t("table.influence")}</span>
          <output className="font-mono text-sm text-foreground" aria-label={t("table.influence")}>
            {state.hand + state.memory}
          </output>
        </div>
      </div>
    </section>
  );
}
