"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Users, UserPlus, Copy, Check, QrCode, Sparkles, Loader2, ShieldCheck, ArrowRight, Layers } from "lucide-react";
import { Modal, PageHeader, CardArt, ElementBadge, FoilBadge, LowPopBadge } from "@/components/common";
import { SkeletonGrid, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import { getElementClass } from "@/lib/elements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Friend { id: string; name: string; friendCode: string; createdAt: string }
interface IdleCard {
  id: string;
  cardName: string;
  cardSlug: string;
  element: string;
  class: string;
  setPrefix: string;
  collectorNumber: string;
  foil: boolean;
  population: number;
  isLowPop: boolean;
  idleQuantity: number;
  imageUrl: string;
}

function FriendCodeCard({ code }: { code: string | null }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(code, { margin: 1, width: 240, color: { dark: "#070a11", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      showToast("Friend Code Copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not access clipboard", "error");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200/10 bg-gradient-to-br from-amber-200/[0.06] via-white/[0.02] to-transparent p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />
      <p className="label-caps">Your Friend Code</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        {code ? (
          <span className="font-mono text-2xl font-semibold tracking-wider text-white sm:text-3xl">{code}</span>
        ) : (
          <span className="skeleton h-8 w-40 rounded" />
        )}
        <div className="flex gap-2">
          <Button onClick={() => setShowQr(true)} disabled={!qr} variant="outline" className="px-3" aria-label="Show friend code QR">
            <QrCode className="h-4 w-4" />
          </Button>
          <Button onClick={copy} disabled={!code}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">Share this with your playgroup. Once linked, you can see each other's idle cards that aren't locked into decks.</p>

      {showQr && qr && (
        <Modal title="Scan to connect" subtitle="Friends can scan this to read your code" onClose={() => setShowQr(false)} size="sm">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-2xl bg-white p-3 shadow-[0_0_60px_-10px_rgba(6,182,212,0.4)]">
              <img src={qr} alt={`QR code for friend code ${code}`} className="h-52 w-52" />
            </div>
            <span className="font-mono text-lg font-semibold tracking-wider text-white">{code}</span>
          </div>
        </Modal>
      )}
    </div>
  );
}

function IdleBinderModal({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  const [cards, setCards] = useState<IdleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/friends/${friend.id}/idle`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCards(Array.isArray(data.idleCards) ? data.idleCards : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [friend.id]);

  const totalIdle = cards.reduce((s, c) => s + c.idleQuantity, 0);

  return (
    <Modal title={`${friend.name}'s Idle Binder`} subtitle="Copies not locked into any of their decks" onClose={onClose} size="xl">
      {loading ? (
        <SkeletonGrid count={6}/>
      ) : error ? (
        <p className="py-12 text-center text-sm text-rose-300">Couldn't load this binder.</p>
      ) : cards.length === 0 ? (
        <EmptyState icon={Layers} title="Nothing idle right now" description={`Every copy ${friend.name} owns is assigned to a deck.`}/>
      ) : (
        <>
          <p className="mb-4 text-xs text-slate-400"><span className="font-mono text-white">{totalIdle}</span> idle copies across <span className="font-mono text-white">{cards.length}</span> printings</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map((c) => (
              <div key={c.id} className={`${getElementClass(c.element)} overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]`}>
                <div className={`relative aspect-[5/4] overflow-hidden ${c.foil ? "foil-static" : ""}`}>
                  <CardArt src={c.imageUrl} alt={c.cardName} className="h-full w-full object-top" />
                  <div className="absolute left-2 top-2 z-[5]"><ElementBadge element={c.element}/></div>
                  <span className="absolute bottom-2 right-2 z-[5] rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 backdrop-blur">{c.idleQuantity} idle</span>
                </div>
                <div className="space-y-1.5 p-2.5">
                  <div className="truncate text-xs font-semibold text-white">{c.cardName}</div>
                  <div className="font-mono text-[10px] text-slate-500">{c.setPrefix} #{c.collectorNumber}</div>
                  <div className="flex flex-wrap gap-1">
                    {c.foil && <FoilBadge/>}
                    {c.isLowPop && <LowPopBadge population={c.population}/>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

export default function FriendsPage() {
  const { showToast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [inspecting, setInspecting] = useState<Friend | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCode(data.currentUser?.friendCode ?? null);
      setFriends(Array.isArray(data.friends) ? data.friends : []);
    } catch {
      showToast("Couldn't load your playgroup", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    const friendCode = input.trim().toUpperCase();
    if (!friendCode) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendCode }),
      });
      const data = await res.json();
      if (!res.ok || !(data.success || data.friend)) throw new Error(data.error);
      showToast(`Connected with ${data.friend?.name || "your friend"}`, "success");
      setInput("");
      load();
    } catch (err: any) {
      showToast(err?.message || "That friend code didn't work", "error");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Playgroup"
        title="Friends & Idle Sharing"
        description="Link up with your local group to see who has spare copies and borrow what your decks are missing."
      />

      <div className="mb-10 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><FriendCodeCard code={code}/></div>
        <form onSubmit={connect} className="flex flex-col justify-between gap-4 rounded-2xl glass p-6 lg:col-span-2">
          <div>
            <p className="label-caps">Connect a Friend</p>
            <p className="mt-2 text-xs text-slate-400">Enter their code to create a mutual link.</p>
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="GA-XXXXXX"
              aria-label="Friend code"
              className="font-mono uppercase tracking-wider"
            />
            <Button type="submit" disabled={connecting || !input.trim()} variant="accent" className="shrink-0">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              <span className="hidden sm:inline">Connect</span>
            </Button>
          </div>
        </form>
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-white">Your Playgroup</h2>
        <span className="font-mono text-xs text-slate-500">{friends.length} linked</span>
      </div>

      {loading ? (
        <SkeletonGrid count={3}/>
      ) : friends.length === 0 ? (
        <EmptyState icon={Users} title="No friends linked yet" description="Swap friend codes with your playgroup to start sharing idle cards." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {friends.map((f) => (
            <article key={f.id} className="hover-lift group flex flex-col rounded-2xl glass p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300/30 to-emerald-300/10 text-sm font-semibold text-white ring-1 ring-white/10">
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-white">{f.name}</h3>
                  <span className="font-mono text-[11px] text-slate-500">{f.friendCode}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-emerald-300/90">
                <ShieldCheck className="h-3.5 w-3.5" /> Mutual link active
              </div>
              <Button onClick={() => setInspecting(f)} variant="outline" className="mt-4 text-xs group-hover:border-cyan-400/30 group-hover:text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" /> View Idle Binder <ArrowRight className="ml-auto h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </article>
          ))}
        </div>
      )}

      {inspecting && <IdleBinderModal friend={inspecting} onClose={() => setInspecting(null)} />}
    </div>
  );
}
