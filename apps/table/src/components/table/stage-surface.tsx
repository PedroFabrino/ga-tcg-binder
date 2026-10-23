"use client";

import type { TableState } from "@ga/contracts";
import { FeedPanel } from "@/components/table/feed-panel";
import {
  RecentPinStrip,
  SeatScoreboard,
  TablePins,
} from "@/components/table/table-status";
import { useTranslation } from "@/lib/i18n";

/**
 * Control-free 16:9 Table for window capture. The interactive Table owns the
 * same Seat; `/stage` is used in its place on the streaming desktop.
 */
export function StageSurface({
  table,
  stream,
  capturePresent,
}: {
  table: TableState | null;
  stream: MediaStream | null;
  capturePresent: boolean;
}) {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-2">
      {table ? (
        <div className="grid aspect-video w-full max-w-[1920px] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-card p-2">
          <div className="grid grid-cols-2 gap-2">
            <SeatScoreboard table={table} seat="p1" compact />
            <SeatScoreboard table={table} seat="p2" compact />
          </div>
          <div className="grid min-h-0 gap-2 md:grid-cols-[minmax(0,1fr)_16rem]">
            <FeedPanel
              stream={stream}
              capturePresent={capturePresent}
              ripples={table.ripples}
              canRipple={false}
              onRipple={() => undefined}
            />
            <div className="min-h-0 overflow-hidden">
              <TablePins table={table} artClassName="h-[240px] w-full" />
            </div>
          </div>
          <RecentPinStrip table={table} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
    </main>
  );
}
