"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  RecentPinStrip,
  SeatScoreboard,
  TablePins,
} from "@/components/table/table-status";
import { TableLoading } from "@/components/table/table-page-shell";
import { useTableSocket } from "@/lib/use-table-socket";
import { browserStorage } from "@/lib/table-session";
import { readTableInvite } from "@/lib/table-invite";
import { useTranslation } from "@/lib/i18n";

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

/**
 * OBS browser source: transparent, video-free chrome designed at 1920×1080 and
 * scaled to the viewport. It reads with the viewer token, so it can never write
 * a Seat or join as a Capture Device.
 */
function OverlayContent() {
  const { t } = useTranslation();
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = String(params?.code ?? "").toUpperCase();
  const [token, setToken] = useState<string | null>(() => search.get("token"));
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (token) return;
    setToken(readTableInvite(code, browserStorage())?.viewerToken ?? null);
  }, [code, token]);

  // The overlay must composite over a window capture; the app's normal
  // background would paint an opaque rectangle behind it.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.background;
    const previousBody = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = previousHtml;
      body.style.background = previousBody;
    };
  }, []);

  useEffect(() => {
    const update = () =>
      setScale(
        Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT)
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { state } = useTableSocket({ code, token: token ?? "", role: "viewer" });
  const table = state.table;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent p-8">
        <p className="max-w-lg text-center text-sm text-white/80">{t("table.viewerMissing")}</p>
      </main>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent text-white">
      <div
        className="absolute left-1/2 top-1/2 h-[1080px] w-[1920px]"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {table ? (
          <div className="flex h-full flex-col justify-between p-8">
            <div className="flex items-start justify-between gap-8">
              <div className="grid w-[1120px] grid-cols-2 gap-4">
                <SeatScoreboard table={table} seat="p1" />
                <SeatScoreboard table={table} seat="p2" />
              </div>
              <p className="text-5xl font-black tracking-tight text-white drop-shadow-lg">
                {t("table.title")}
              </p>
            </div>

            <div className="flex items-end justify-between gap-10">
              <div className="w-[600px]">
                <TablePins table={table} artClassName="h-[350px] w-full" />
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/55 px-4 py-3">
                <RecentPinStrip table={table} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-white/80">{t("common.loading")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={<TableLoading />}>
      <OverlayContent />
    </Suspense>
  );
}
