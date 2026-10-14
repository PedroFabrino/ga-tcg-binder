"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Layers, Sparkles, BookOpen, Trophy, Users, QrCode, Gem, ArrowRight, TrendingUp, Package, Swords, AlertTriangle,
} from "lucide-react";

interface Stats {
  totalCards: number;
  lowPopCount: number;
  staplesCount: number;
  idleCount: number;
  decksCount: number;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night grind";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [hello, setHello] = useState("Welcome back");

  useEffect(() => {
    setHello(greeting());
    async function loadStats() {
      try {
        const [collRes, decksRes] = await Promise.all([fetch("/api/collection?view=ALL"), fetch("/api/decks")]);
        if (!collRes.ok || !decksRes.ok) throw new Error("Request failed");
        const collData = await collRes.json();
        const decksData = await decksRes.json();
        const items: any[] = Array.isArray(collData.items) ? collData.items : [];
        const decks: any[] = Array.isArray(decksData.decks) ? decksData.decks : [];
        setStats({
          totalCards: items.reduce((s, i) => s + (i.quantity || 0), 0),
          lowPopCount: items.filter((i) => i.isLowPop).length,
          staplesCount: items.filter((i) => i.activeDeckUsages >= 2).length,
          idleCount: items.reduce((s, i) => s + (i.idleQuantity || 0), 0),
          decksCount: decks.length,
        });
      } catch {
        setError(true);
      }
    }
    loadStats();
  }, []);

  const name = session?.user?.name?.split(" ")[0] || "Collector";

  const metrics = [
    { label: "Physical Copies", value: stats?.totalCards, hint: "Registered in your binder", icon: Package, href: "/collection?view=ALL", el: "el-norm" },
    { label: "Collector Gems", value: stats?.lowPopCount, hint: "Low population printings", icon: Gem, href: "/collection?view=LOW_POP", gold: true },
    { label: "Tournament Staples", value: stats?.staplesCount, hint: "Used in 2+ decks", icon: TrendingUp, href: "/collection?view=STAPLES", el: "el-water" },
    { label: "Idle Copies", value: stats?.idleCount, hint: "Unassigned, ready to lend", icon: Sparkles, href: "/collection?view=IDLE", el: "el-wind" },
    { label: "Active Decks", value: stats?.decksCount, hint: "Constructed lists", icon: Swords, href: "/decks", el: "el-fire" },
  ];

  const tiles = [
    { href: "/catalog", title: "Card Catalog", desc: "Every printing, rarity and circulation count across DOA, FTC, ALC, MRC and promos.", icon: Sparkles, el: "el-water" },
    { href: "/meta", title: "Meta Explorer", desc: "Tiered tournament archetypes with one-click gap analysis against your binder.", icon: Trophy, el: "el-earth" },
    { href: "/friends", title: "Playgroup Friends", desc: "Link friend codes and discover idle copies you can borrow before events.", icon: Users, el: "el-wind" },
    { action: "open-scanner", title: "Mobile Scan", desc: "Pair your phone camera and stream card scans straight into your binder.", icon: QrCode, el: "el-fire" },
  ];

  return (
    <div className="space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0b0f19] p-6 sm:p-10 animate-fade-in">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-amber-400/[0.07] blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="label-caps mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            Grand Archive Collection Hub
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            {hello}, <span className="bg-gradient-to-r from-amber-100 via-amber-200 to-amber-400 bg-clip-text text-transparent">{name}</span>.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
            {stats
              ? `${stats.totalCards.toLocaleString()} copies across your binder, ${stats.decksCount} active deck${stats.decksCount === 1 ? "" : "s"}, and ${stats.idleCount} idle copies ready to lend.`
              : "Track exact printings, cross-deck sharing and playgroup idle copies before every event."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a href="/collection" className="btn-primary !rounded-full"><Layers className="h-4 w-4" /> Open Binder</a>
            <a href="/decks" className="btn-ghost !rounded-full"><BookOpen className="h-4 w-4" /> Build Deck</a>
            <a href="/decks" className="btn-ghost !rounded-full"><AlertTriangle className="h-4 w-4 text-amber-300" /> Check Shortages</a>
          </div>
        </div>
      </section>

      <section aria-label="Collection metrics">
        {error && (
          <p className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            We couldn&apos;t load your collection stats. Refresh to try again.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <a
                key={m.label}
                href={m.href}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`${m.el || ""} group relative overflow-hidden rounded-2xl glass p-5 hover-lift animate-fade-in ${i === 4 ? "col-span-2 lg:col-span-1" : ""} ${
                  m.gold ? "border-amber-300/20 shadow-[0_0_30px_-12px_rgba(232,201,103,0.4)]" : ""
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{m.label}</span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${m.gold ? "gold-badge" : "el-bg-soft el-text"}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                {stats ? (
                  <div className={`font-mono text-3xl font-semibold tracking-tight ${m.gold ? "text-amber-200" : "text-white"}`}>
                    {(m.value ?? 0).toLocaleString()}
                  </div>
                ) : (
                  <div className="skeleton h-9 w-16 rounded-md" />
                )}
                <p className="mt-1 text-xs text-slate-500">{m.hint}</p>
                <ArrowRight className="absolute bottom-5 right-5 h-3.5 w-3.5 text-slate-600 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </a>
            );
          })}
        </div>
      </section>

      <section aria-label="Quick jump">
        <h2 className="label-caps mb-4">Jump To</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            const inner = (
              <>
                <div className="el-bg-soft el-border el-text mb-5 flex h-11 w-11 items-center justify-center rounded-xl border transition-shadow group-hover:el-glow">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="flex items-center justify-between text-[15px] font-semibold text-white">
                  {t.title}
                  <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{t.desc}</p>
              </>
            );
            const cls = `${t.el} group rounded-2xl glass p-6 text-left hover-lift hover:border-white/[0.12]`;
            return t.href ? (
              <a key={t.title} href={t.href} className={cls}>{inner}</a>
            ) : (
              <button key={t.title} onClick={() => window.dispatchEvent(new Event(t.action!))} className={cls}>{inner}</button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
