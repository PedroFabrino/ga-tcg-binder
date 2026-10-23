"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { SeatId, SeatState, TranslationKey } from "@ga/contracts";
import { InvitePanel } from "@/components/table/invite-panel";
import { SeatHud } from "@/components/table/seat-hud";
import { useTranslation } from "@/lib/i18n";
import { readTableInvite, type TableInvite } from "@/lib/table-invite";
import {
  browserStorage,
  parseSeatSession,
  readSeatSession,
  saveSeatSession,
  type SeatSession,
} from "@/lib/table-session";
import { useTableSocket } from "@/lib/use-table-socket";

const ERROR_KEYS: Record<string, TranslationKey> = {
  INVALID_TOKEN: "table.errors.invalidToken",
  WRONG_CODE: "table.errors.wrongCode",
  NO_SUCH_TABLE: "table.errors.noSuchTable",
  DISPLACED: "table.errors.displaced",
  FORBIDDEN: "table.errors.forbidden",
  NOT_YOUR_TURN: "table.errors.notYourTurn",
  BAD_REQUEST: "table.errors.badRequest",
  INVALID_MESSAGE: "table.errors.invalidMessage",
  NO_TARGET: "table.errors.noTarget",
};

const BLOCKING_ERRORS = new Set(["DISPLACED", "INVALID_TOKEN", "WRONG_CODE", "NO_SUCH_TABLE"]);

function errorKey(code: string): TranslationKey {
  return ERROR_KEYS[code] ?? "table.errors.generic";
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      {children}
    </main>
  );
}

function LoadingPage() {
  const { t } = useTranslation();
  return (
    <TableShell>
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    </TableShell>
  );
}

function NoSeat({ code }: { code: string }) {
  const { t } = useTranslation();

  return (
    <TableShell>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("table.title")}</h1>
        <span className="font-mono text-sm text-muted-foreground">{code}</span>
      </header>
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t("table.noSeatTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("table.noSeatHint")}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("table.backHome")}
        </Link>
      </section>
    </TableShell>
  );
}

function ConnectedTable({ code, session }: { code: string; session: SeatSession }) {
  const { t } = useTranslation();
  const { state, status, send, patchSeat, reconnect } = useTableSocket({
    code,
    token: session.token,
    role: "seat",
  });
  const [pending, setPending] = useState<Partial<SeatState>>({});
  const [invite, setInvite] = useState<TableInvite | null>(null);

  useEffect(() => {
    setInvite(readTableInvite(code, browserStorage()));
  }, [code]);

  const editSeat = useCallback(
    (patch: Partial<SeatState>) => {
      patchSeat(session.seat, patch);
      setPending((current) => ({ ...current, ...patch }));
    },
    [patchSeat, session.seat]
  );

  // Debounce the wire write so a burst of keystrokes is one SEAT_UPDATE and one
  // log entry, while the optimistic patch above updates this screen immediately.
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    const timer = setTimeout(() => {
      send({ type: "SEAT_UPDATE", patch: pending });
      setPending({});
    }, 200);
    return () => clearTimeout(timer);
  }, [pending, send]);

  const table = state.table;
  const otherSeat: SeatId = session.seat === "p1" ? "p2" : "p1";
  const ownState = table?.seats[session.seat];
  const otherState = table?.seats[otherSeat];
  const ownDisplay = ownState ? { ...ownState, ...pending } : undefined;
  const blockingError = state.error !== null && BLOCKING_ERRORS.has(state.error.code);
  const canEdit = status === "open" && !blockingError;

  const statusLabel =
    status === "open"
      ? t("table.connected")
      : status === "connecting"
        ? t("table.connecting")
        : t("table.disconnected");
  const statusClass =
    status === "open"
      ? "rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground"
      : status === "connecting"
        ? "rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
        : "rounded-full bg-destructive/20 px-2 py-0.5 text-xs text-destructive";

  return (
    <TableShell>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold">{t("table.title")}</h1>
          <span className="text-sm text-muted-foreground">
            {t("table.roomCode")}: <span className="font-mono">{code}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={statusClass}>{statusLabel}</span>
          {status === "closed" && (
            <button
              type="button"
              onClick={reconnect}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              {t("table.reconnect")}
            </button>
          )}
        </div>
      </header>

      {state.error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm"
        >
          <span>{t(errorKey(state.error.code))}</span>
          <div className="flex items-center gap-2">
            {state.error.code === "DISPLACED" && (
              <button
                type="button"
                onClick={reconnect}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
              >
                {t("table.takeOver")}
              </button>
            )}
            <Link href="/" className="text-xs text-muted-foreground underline">
              {t("table.backHome")}
            </Link>
          </div>
        </div>
      )}

      {invite && session.seat === "p1" && (
        <InvitePanel code={code} p2Token={invite.p2Token} />
      )}

      {!table ? (
        state.error ? null : (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <SeatHud
            seat="p1"
            state={session.seat === "p1" ? ownDisplay : otherState}
            isOwn={session.seat === "p1"}
            editable={session.seat === "p1" && canEdit}
            active={table.active === "p1"}
            onEdit={editSeat}
          />
          <SeatHud
            seat="p2"
            state={session.seat === "p2" ? ownDisplay : otherState}
            isOwn={session.seat === "p2"}
            editable={session.seat === "p2" && canEdit}
            active={table.active === "p2"}
            onEdit={editSeat}
          />
        </div>
      )}
    </TableShell>
  );
}

function TablePageContent() {
  const { t } = useTranslation();
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = String(params?.code ?? "").toUpperCase();
  const [session, setSession] = useState<SeatSession | null>(() => parseSeatSession(search));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = parseSeatSession(search);
    if (fromUrl) {
      setSession((current) =>
        current && current.seat === fromUrl.seat && current.token === fromUrl.token
          ? current
          : fromUrl
      );
    } else if (!session) {
      const resolved = readSeatSession(code, search, browserStorage());
      if (resolved) setSession(resolved);
    }
    setReady(true);
  }, [code, search, session]);

  useEffect(() => {
    if (session) saveSeatSession(code, session, browserStorage());
  }, [code, session]);

  if (!ready && !session) return <LoadingPage />;
  if (!session) return <NoSeat code={code} />;

  return (
    <ConnectedTable
      key={`${code}:${session.seat}:${session.token}`}
      code={code}
      session={session}
    />
  );
}

export default function TablePage() {
  // `useSearchParams` needs a Suspense boundary during prerendering.
  return (
    <Suspense fallback={<LoadingPage />}>
      <TablePageContent />
    </Suspense>
  );
}
