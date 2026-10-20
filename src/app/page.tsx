"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
Layers, Sparkles, BookOpen, Trophy, Users, QrCode, Gem, ArrowRight, TrendingUp, Package, Swords, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";
import { useTranslation } from "@/lib/i18n";

interface Stats {
totalCards: number;
lowPopCount: number;
staplesCount: number;
idleCount: number;
decksCount: number;
}

function greetingKey(): "home.greetingMorning" | "home.greetingAfternoon" | "home.greetingEvening" | "home.greetingLateNight" {
const h = new Date().getHours();
if (h < 5) return "home.greetingLateNight";
if (h < 12) return "home.greetingMorning";
if (h < 18) return "home.greetingAfternoon";
return "home.greetingEvening";
}

export default function HomePage() {
const { t } = useTranslation();
const { data: session } = useSession();
const [stats, setStats] = useState<Stats | null>(null);
const [error, setError] = useState(false);
const [helloKey, setHelloKey] = useState<ReturnType<typeof greetingKey>>("home.welcomeBack" as ReturnType<typeof greetingKey>);

  useEffect(() => {
  setHelloKey(greetingKey());
    async function loadStats() {
      try {
        const userParam = session?.user?.id ? `&userId=${encodeURIComponent(session.user.id)}` : "";
        const decksUserParam = session?.user?.id ? `?userId=${encodeURIComponent(session.user.id)}` : "";
        const [collRes, decksRes] = await Promise.all([
          fetch(`/api/collection?view=ALL${userParam}`),
          fetch(`/api/decks${decksUserParam}`),
        ]);
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
  }, [session?.user?.id]);

  const name = session?.user?.name?.split(" ")[0] || "Collector";
  
  const metrics = [
  { labelKey: "home.physicalCopies" as const, value: stats?.totalCards, hintKey: "home.physicalCopiesHint" as const, icon: Package, href: "/collection?view=ALL", el: "el-norm" },
  { labelKey: "home.collectorGems" as const, value: stats?.lowPopCount, hintKey: "home.collectorGemsHint" as const, icon: Gem, href: "/collection?view=LOW_POP", gold: true },
  { labelKey: "home.tournamentStaples" as const, value: stats?.staplesCount, hintKey: "home.tournamentStaplesHint" as const, icon: TrendingUp, href: "/collection?view=STAPLES", el: "el-water" },
  { labelKey: "home.idleCopies" as const, value: stats?.idleCount, hintKey: "home.idleCopiesHint" as const, icon: Sparkles, href: "/collection?view=IDLE", el: "el-wind" },
  { labelKey: "home.activeDecks" as const, value: stats?.decksCount, hintKey: "home.activeDecksHint" as const, icon: Swords, href: "/decks", el: "el-fire" },
  ];
  
  const tiles = [
  { href: "/catalog", titleKey: "home.cardCatalog" as const, descKey: "home.cardCatalogDesc" as const, icon: Sparkles, el: "el-water" },
  { href: "/meta", titleKey: "home.metaExplorer" as const, descKey: "home.metaExplorerDesc" as const, icon: Trophy, el: "el-earth" },
  { href: "/friends", titleKey: "home.playgroupFriends" as const, descKey: "home.playgroupFriendsDesc" as const, icon: Users, el: "el-wind" },
  ...(FEATURES.scanner
  ? [{ action: "open-scanner", titleKey: "home.mobileScan" as const, descKey: "home.mobileScanDesc" as const, icon: QrCode, el: "el-fire" }]
  : []),
  ];

  return (
    <div className="space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0b0f19] p-6 sm:p-10 animate-fade-in">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-amber-400/[0.07] blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="label-caps mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            {t("home.collectionHub")}
            </p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            {t(helloKey)}, <span className="bg-gradient-to-r from-amber-100 via-amber-200 to-amber-400 bg-clip-text text-transparent">{name}</span>.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          {stats
          ? t("home.dashboardSubtitleLoaded", {
          copies: stats.totalCards.toLocaleString(),
          decks: String(stats.decksCount),
          plural: stats.decksCount === 1 ? "" : "s",
          idle: String(stats.idleCount),
          })
          : t("home.dashboardSubtitleEmpty")}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild className="rounded-full"><a href="/collection"><Layers className="h-4 w-4" /> {t("home.openBinder")}</a></Button>
          <Button asChild variant="outline" className="rounded-full"><a href="/decks"><BookOpen className="h-4 w-4" /> {t("home.buildDeck")}</a></Button>
          <Button asChild variant="outline" className="rounded-full"><a href="/decks"><AlertTriangle className="h-4 w-4 text-amber-300" /> {t("home.checkShortages")}</a></Button>
          </div>
        </div>
      </section>

      <section aria-label={t("home.dashboardTitle")}>
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
                key={m.labelKey}
                href={m.href}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`${m.el || ""} group relative overflow-hidden rounded-2xl glass p-5 hover-lift animate-fade-in ${i === 4 ? "col-span-2 lg:col-span-1" : ""} ${
                  m.gold ? "border-amber-300/20 shadow-[0_0_30px_-12px_rgba(232,201,103,0.4)]" : ""
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{t(m.labelKey)}</span>
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
                <p className="mt-1 text-xs text-slate-500">{t(m.hintKey)}</p>
                <ArrowRight className="absolute bottom-5 right-5 h-3.5 w-3.5 text-slate-600 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </a>
            );
          })}
        </div>
      </section>

      <section aria-label="Quick jump">
        <h2 className="label-caps mb-4">Jump To</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => {
          const Icon = tile.icon;
          const inner = (
          <>
          <div className="el-bg-soft el-border el-text mb-5 flex h-11 w-11 items-center justify-center rounded-xl border transition-shadow group-hover:el-glow">
          <Icon className="h-5 w-5" />
          </div>
          <h3 className="flex items-center justify-between text-[15px] font-semibold text-white">
          {t(tile.titleKey)}
          <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{t(tile.descKey)}</p>
              </>
            );
            const cls = `${tile.el} group rounded-2xl glass p-6 text-left hover-lift hover:border-white/[0.12]`;
            return tile.href ? (
            <a key={tile.titleKey} href={tile.href} className={cls}>{inner}</a>
            ) : (
            <button key={tile.titleKey} onClick={() => window.dispatchEvent(new Event(tile.action!))} className={cls}>{inner}</button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
