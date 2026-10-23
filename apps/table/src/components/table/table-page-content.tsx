"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type SeatState } from "@ga/contracts";
import { ActionLog } from "@/components/table/action-log";
import { CameraPairing } from "@/components/table/camera-pairing";
import { DeckPanel } from "@/components/table/deck-panel";
import { FeedPanel } from "@/components/table/feed-panel";
import { InvitePanel } from "@/components/table/invite-panel";
import { PinPanel } from "@/components/table/pin-panel";
import { SeatHud } from "@/components/table/seat-hud";
import { StageSurface } from "@/components/table/stage-surface";
import {
  TableLoading,
  TableNoSeat,
  TableShell,
} from "@/components/table/table-page-shell";
import { TurnBar } from "@/components/table/turn-bar";
import { fetchWithTimeout } from "@/lib/card-catalog";
import { getCardDetailCache, useCardCatalog } from "@/lib/use-card-catalog";
import {
  clearDeck,
  importDeck,
  readDeck,
  saveDeck,
  type StoredDeck,
} from "@/lib/deck-storage";
import { tableErrorKey } from "@/lib/table-errors";
import { useTableFeed } from "@/lib/use-table-feed";
import { useTranslation } from "@/lib/i18n";
import { readTableInvite, type TableInvite } from "@/lib/table-invite";
import {
  browserStorage,
  parseSeatSession,
  readSeatSession,
  saveSeatSession,
  type SeatSession,
} from "@/lib/table-session";

function ConnectedTable({
  code,
  session,
  mode,
}: {
  code: string;
  session: SeatSession;
  mode: "table" | "stage";
}) {
  const { t } = useTranslation();
  const {
    state,
    status,
    send,
    patchSeat,
    reconnect,
    otherSeat,
    blockingError,
    opponentCapture,
    localCapture,
    remoteStream,
  } = useTableFeed({ code, token: session.token, seat: session.seat });
  const [pending, setPending] = useState<Partial<SeatState>>({});
  const [invite, setInvite] = useState<TableInvite | null>(null);
  const [turnPending, setTurnPending] = useState(false);
  const [deck, setDeck] = useState<StoredDeck | null>(null);
  const catalog = useCardCatalog();

  useEffect(() => {
    setInvite(readTableInvite(code, browserStorage()));
  }, [code]);

  useEffect(() => {
    setDeck(readDeck(code, session.seat, browserStorage()));
  }, [code, session.seat]);

  const editSeat = useCallback(
    (patch: Partial<SeatState>) => {
      patchSeat(session.seat, patch);
      setPending((current) => ({ ...current, ...patch }));
    },
    [patchSeat, session.seat]
  );

  const importDeckForSeat = useCallback(
    async (rawText: string) => {
      const next = await importDeck(rawText, {
        cards: catalog.cards,
        detailCache: getCardDetailCache(),
        fetcher: fetchWithTimeout(),
      });
      saveDeck(code, session.seat, next, browserStorage());
      setDeck(next);
      // Only fill the HUD from a resolved Champion; a catalog outage must not
      // wipe a Champion the player already typed in.
      if (next.champion?.card?.slug) {
        editSeat({ championSlug: next.champion.card.slug });
      }
    },
    [catalog.cards, code, editSeat, session.seat]
  );

  const clearDeckForSeat = useCallback(() => {
    clearDeck(code, session.seat, browserStorage());
    setDeck(null);
  }, [code, session.seat]);

  const pinCard = useCallback(
    (cardSlug: string, printingSlug?: string) => {
      send(
        printingSlug
          ? { type: "PIN_SET", cardSlug, printingSlug }
          : { type: "PIN_SET", cardSlug }
      );
    },
    [send]
  );

  const clearPin = useCallback(() => {
    send({ type: "PIN_CLEAR" });
  }, [send]);

  const dropRipple = useCallback(
    (x: number, y: number) => {
      send({ type: "RIPPLE", x, y });
    },
    [send]
  );

  const startTurn = useCallback(() => {
    if (turnPending) return;
    setTurnPending(true);
    send({ type: "TURN_START" });
  }, [send, turnPending]);

  const endTurn = useCallback(() => {
    if (turnPending) return;
    setTurnPending(true);
    send({ type: "TURN_END" });
  }, [send, turnPending]);

  // The server remains the authority; this short local guard only stops a
  // double click from sending two commands before the broadcast lands.
  useEffect(() => {
    if (!turnPending) return;
    const timer = setTimeout(() => setTurnPending(false), 1500);
    return () => clearTimeout(timer);
  }, [turnPending]);

  // A successful turn command changes `active`; release the button as soon as
  // the authoritative snapshot arrives instead of waiting for the guard.
  useEffect(() => {
    setTurnPending(false);
  }, [state.table?.active]);

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
  const ownState = table?.seats[session.seat];
  const otherState = table?.seats[otherSeat];
  const ownDisplay = ownState ? { ...ownState, ...pending } : undefined;
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

  if (mode === "stage") {
    return (
      <StageSurface
        table={table}
        stream={remoteStream}
        capturePresent={opponentCapture}
      />
    );
  }

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
          <span>{t(tableErrorKey(state.error.code))}</span>
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
        <InvitePanel
          code={code}
          p2Token={invite.p2Token}
          viewerToken={invite.viewerToken}
        />
      )}

      {!table ? (
        state.error ? null : (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <FeedPanel
              stream={remoteStream}
              capturePresent={opponentCapture}
              ripples={table.ripples}
              canRipple={canEdit}
              onRipple={dropRipple}
            />
            <CameraPairing
              code={code}
              seat={session.seat}
              token={session.token}
              connected={localCapture}
            />
          </div>
          <TurnBar
            active={table.active}
            seat={session.seat}
            seats={table.seats}
            canAct={canEdit}
            pending={turnPending}
            onStart={startTurn}
            onEnd={endTurn}
          />
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
          <div className="grid gap-4 lg:grid-cols-2">
            <DeckPanel
              deck={deck}
              catalog={catalog}
              onImport={importDeckForSeat}
              onClear={clearDeckForSeat}
            />
            <PinPanel
              table={table}
              seat={session.seat}
              deck={deck}
              catalog={catalog}
              canAct={canEdit}
              onPin={pinCard}
              onClear={clearPin}
            />
          </div>
          <ActionLog entries={table.log} seats={table.seats} />
        </>
      )}
    </TableShell>
  );
}

export function TablePageContent({ mode = "table" }: { mode?: "table" | "stage" }) {
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

  if (!ready && !session) return <TableLoading />;
  if (!session) return <TableNoSeat code={code} />;

  return (
    <ConnectedTable
      key={`${code}:${session.seat}:${session.token}`}
      code={code}
      session={session}
      mode={mode}
    />
  );
}

