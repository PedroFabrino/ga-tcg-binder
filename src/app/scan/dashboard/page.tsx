"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Smartphone,
  Wifi,
  WifiOff,
  RotateCw,
  Check,
  Sparkles,
  QrCode,
  Layers,
  ArrowRight,
  ShieldCheck,
  Copy,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ToastProvider";
import type {
  CommittedCardPayload,
  WsServerMessage,
  WsJoinMessage,
  WsCardUpdateFinishMessage,
} from "@ga/contracts";

interface ScannedSessionCard extends CommittedCardPayload {
  persisted?: boolean;
}

export default function ScannerDashboardPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<{
    id: string;
    token: string;
    qrCodeDataUrl: string;
    wsEndpoint: string;
    pairingUrl: string;
  } | null>(null);

  const [wsStatus, setWsStatus] = useState<"DISCONNECTED" | "CONNECTING" | "PAIRED">("DISCONNECTED");
  const [pairedDevice, setPairedDevice] = useState<string | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const [heroCard, setHeroCard] = useState<ScannedSessionCard | null>(null);
  const [feed, setFeed] = useState<ScannedSessionCard[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pingStartRef = useRef<number>(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or reset session
  const initSession = useCallback(async () => {
    setLoading(true);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    try {
      const res = await fetch("/api/scanner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create scanner session");
      const data = await res.json();
      setSessionInfo({
        id: data.id,
        token: data.token,
        qrCodeDataUrl: data.qrCodeDataUrl,
        wsEndpoint: data.wsEndpoint || process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001",
        pairingUrl: data.pairingUrl,
      });
      setWsStatus("CONNECTING");
    } catch (err: any) {
      showToast(err.message || "Failed to initialize scanner session", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    initSession();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [initSession]);

  // Connect to WebSocket session room
  useEffect(() => {
    if (!sessionInfo) return;

    let active = true;
    const ws = new WebSocket(sessionInfo.wsEndpoint);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!active) return;
      const joinMsg: WsJoinMessage = {
        type: "SESSION_JOIN",
        sessionId: sessionInfo.id,
        token: sessionInfo.token,
        role: "receiver",
        timestamp: Date.now(),
        deviceName: "Desktop Web Receiver",
      };
      ws.send(JSON.stringify(joinMsg));

      // Periodic ping
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingStartRef.current = Date.now();
          ws.send(
            JSON.stringify({
              type: "SESSION_PING",
              sessionId: sessionInfo.id,
              timestamp: Date.now(),
            })
          );
        }
      }, 15000);
    };

    ws.onmessage = async (event) => {
      if (!active) return;
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "SESSION_STATUS") {
        if (msg.status === "paired") {
          setWsStatus("PAIRED");
          setPairedDevice(msg.pairedDevice || "Companion Phone");
        } else {
          setWsStatus("DISCONNECTED");
          setPairedDevice(null);
        }
      } else if (msg.type === "SESSION_PONG") {
        if (pingStartRef.current) {
          setPing(Date.now() - pingStartRef.current);
        }
      } else if (msg.type === "CARD_BROADCAST") {
        const newCard: ScannedSessionCard = { ...msg.card, persisted: false };
        setHeroCard(newCard);
        setFeed((prev) => [newCard, ...prev]);

        // Automatically commit card to collection database
        try {
          await fetch("/api/collection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              editionId: newCard.editionId,
              foil: newCard.foil,
              quantity: 1,
            }),
          });
          setFeed((prev) =>
            prev.map((c) =>
              c.editionId === newCard.editionId && c.timestamp === newCard.timestamp
                ? { ...c, persisted: true }
                : c
            )
          );
        } catch {
          // Keep in feed, user can retry
        }
      } else if (msg.type === "CARD_FINISH_UPDATED") {
        setHeroCard((curr) =>
          curr && curr.editionId === msg.editionId ? { ...curr, foil: msg.foil } : curr
        );
        setFeed((prev) =>
          prev.map((c) => (c.editionId === msg.editionId ? { ...c, foil: msg.foil } : c))
        );
      }
    };

    ws.onclose = () => {
      if (!active) return;
      setWsStatus("DISCONNECTED");
      setPairedDevice(null);
    };

    return () => {
      active = false;
      ws.close();
    };
  }, [sessionInfo]);

  // Handle finish toggle from desktop
  const toggleFinish = async (card: ScannedSessionCard) => {
    if (!sessionInfo) return;
    const nextFoil = !card.foil;

    // Send update over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const updateMsg: WsCardUpdateFinishMessage = {
        type: "CARD_UPDATE_FINISH",
        sessionId: sessionInfo.id,
        editionId: card.editionId,
        timestamp: card.timestamp,
        foil: nextFoil,
      };
      wsRef.current.send(JSON.stringify(updateMsg));
    }

    // Update local state
    setHeroCard((curr) =>
      curr && curr.editionId === card.editionId ? { ...curr, foil: nextFoil } : curr
    );
    setFeed((prev) =>
      prev.map((c) =>
        c.editionId === card.editionId && c.timestamp === card.timestamp
          ? { ...c, foil: nextFoil }
          : c
      )
    );

    // Persist change
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: card.editionId,
          foil: nextFoil,
          quantity: 1,
        }),
      });
      showToast(`Updated to ${nextFoil ? "Foil" : "Normal"}`, "success");
    } catch {
      showToast("Failed to update card finish", "error");
    }
  };

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedWs, setCopiedWs] = useState(false);

  const copySessionId = () => {
    if (!sessionInfo?.id) return;
    navigator.clipboard.writeText(sessionInfo.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyWsEndpoint = () => {
    if (!sessionInfo?.wsEndpoint) return;
    navigator.clipboard.writeText(sessionInfo.wsEndpoint);
    setCopiedWs(true);
    setTimeout(() => setCopiedWs(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              Companion Scanner Dashboard
              <Badge variant="default" className="text-xs border-zinc-700 text-zinc-400">
                Live Receiver
              </Badge>
            </h1>
            <p className="text-xs text-zinc-400">
              Session: <span className="font-mono text-zinc-300">{sessionInfo?.id || "..."}</span>
            </p>
          </div>
        </div>

        {/* Status Pill & Action Buttons */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900 text-xs font-medium">
            {wsStatus === "PAIRED" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400">
                  {pairedDevice ? `Connected: ${pairedDevice}` : "Companion Paired"}
                </span>
                {ping !== null && <span className="text-zinc-500 text-[10px]">({ping}ms)</span>}
              </>
            ) : wsStatus === "CONNECTING" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-amber-400">Waiting for Companion Phone...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-400">Disconnected</span>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={initSession}
            disabled={loading}
            className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Pair New Device
          </Button>
        </div>
      </header>

      {/* Main Workspace: Split View */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left / Center Area: Spotlight Hero Card or Pairing QR Code */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center p-8 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900/40 relative">
          {heroCard ? (
            <div className="flex flex-col items-center max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
              {/* Card Badge Header */}
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="success" className="text-xs px-2.5 py-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  {heroCard.confidence.toFixed(1)}% Match Certainty
                </Badge>
                <Badge variant="default" className="border-zinc-700 text-zinc-400 text-xs">
                  {heroCard.setPrefix} • #{heroCard.collectorNumber}
                </Badge>
              </div>

              {/* High-Resolution Artwork */}
              <div className="relative w-64 h-[358px] rounded-xl overflow-hidden shadow-2xl border-2 border-zinc-700 bg-zinc-900 group">
                {heroCard.imageUrl ? (
                  <Image
                    src={heroCard.imageUrl}
                    alt={heroCard.cardName}
                    fill
                    className="object-cover"
                    sizes="256px"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Layers className="w-12 h-12" />
                  </div>
                )}
                {/* Holographic Sheen Overlay for Foils */}
                {heroCard.foil && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/20 via-transparent to-amber-500/20 pointer-events-none mix-blend-overlay" />
                )}
              </div>

              {/* Card Meta & Finish Controls */}
              <div className="mt-5 text-center w-full">
                <h2 className="text-2xl font-bold text-white tracking-tight">{heroCard.cardName}</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Edition ID: <span className="font-mono text-zinc-500 text-xs">{heroCard.editionId}</span>
                </p>

                {/* Interactive Finish Switcher */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant={!heroCard.foil ? "default" : "outline"}
                    onClick={() => toggleFinish(heroCard)}
                    className={
                      !heroCard.foil
                        ? "bg-zinc-200 text-zinc-950 font-medium hover:bg-white"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    }
                  >
                    Normal (Non-foil)
                  </Button>
                  <Button
                    size="sm"
                    variant={heroCard.foil ? "default" : "outline"}
                    onClick={() => toggleFinish(heroCard)}
                    className={
                      heroCard.foil
                        ? "bg-gradient-to-r from-amber-500 to-violet-500 text-white font-medium hover:opacity-90"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Foil Finish
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Idle QR Code Pairing Spotlight */
            <div className="flex flex-col items-center max-w-sm text-center">
              <div className="p-3 bg-white rounded-2xl shadow-2xl border border-zinc-700 relative group">
                {sessionInfo?.qrCodeDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sessionInfo.qrCodeDataUrl}
                    alt="Pairing QR Code"
                    className="w-56 h-56 rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-zinc-100 rounded-lg">
                    <QrCode className="w-12 h-12 text-zinc-400 animate-pulse" />
                  </div>
                )}
              </div>

              <div className="mt-6 text-center">
                <h3 className="text-lg font-semibold text-white">Scan with Mobile Companion</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Point your phone camera to pair. Card recognitions will stream to this screen in real time.
                </p>
              </div>

              {/* Pairing Details Callout */}
              <div className="mt-5 w-full bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 space-y-2.5 text-left text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Session Code:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-base font-bold text-emerald-400 tracking-wider">
                      {sessionInfo?.id || "..."}
                    </span>
                    <button
                      type="button"
                      onClick={copySessionId}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Copy Session Code"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Gateway:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-zinc-300 text-[11px] truncate max-w-[190px]">
                      {sessionInfo?.wsEndpoint || "..."}
                    </span>
                    <button
                      type="button"
                      onClick={copyWsEndpoint}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Copy Gateway Endpoint"
                    >
                      {copiedWs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500 text-center">
                  Phone and computer must be on the same local Wi-Fi network.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Real-Time Chronological Session Feed */}
        <aside className="lg:col-span-4 flex flex-col bg-zinc-950 border-t lg:border-t-0 border-zinc-800 h-full">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Session Feed</h3>
              <Badge variant="default" className="bg-zinc-800 text-zinc-300 text-xs">
                {feed.length}
              </Badge>
            </div>
            <Link
              href="/collection"
              className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              View Collection <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60 p-2">
            {feed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                <Layers className="w-10 h-10 mb-2 stroke-[1.5]" />
                <p className="text-sm">No cards scanned yet in this session.</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Cards confirmed on your phone will appear here live.
                </p>
              </div>
            ) : (
              feed.map((card, idx) => (
                <div
                  key={`${card.editionId}-${card.timestamp}`}
                  onClick={() => setHeroCard(card)}
                  className={`p-3 rounded-lg flex items-center gap-3 transition-colors cursor-pointer group ${
                    heroCard?.editionId === card.editionId && heroCard.timestamp === card.timestamp
                      ? "bg-zinc-900 border border-zinc-800"
                      : "hover:bg-zinc-900/50"
                  }`}
                >
                  <div className="relative w-11 h-14 rounded overflow-hidden flex-shrink-0 bg-zinc-900 border border-zinc-800">
                    {card.imageUrl ? (
                      <Image
                        src={card.imageUrl}
                        alt={card.cardName}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Layers className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white truncate">{card.cardName}</p>
                      <span className="text-[11px] text-zinc-500">
                        {new Date(card.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-400">
                        {card.setPrefix} #{card.collectorNumber}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFinish(card);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium border transition-colors ${
                          card.foil
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                        }`}
                      >
                        {card.foil ? "Foil" : "Normal"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
