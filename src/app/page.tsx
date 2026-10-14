"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Layers,
  Sparkles,
  BookOpen,
  Trophy,
  Users,
  QrCode,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  LogIn,
} from "lucide-react";

export default function HomePage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({
    totalCards: 0,
    lowPopCount: 0,
    staplesCount: 0,
    idleCount: 0,
    decksCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [collRes, decksRes] = await Promise.all([
          fetch("/api/collection?view=ALL"),
          fetch("/api/decks"),
        ]);
        const collData = await collRes.json();
        const decksData = await decksRes.json();

        const items = collData.items || [];
        const decks = decksData.decks || [];

        const totalCards = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
        const lowPopCount = items.filter((i: any) => i.isLowPop).length;
        const staplesCount = items.filter((i: any) => i.activeDeckUsages >= 2).length;
        const idleCount = items.reduce((sum: number, i: any) => sum + i.idleQuantity, 0);

        setStats({
          totalCards,
          lowPopCount,
          staplesCount,
          idleCount,
          decksCount: decks.length,
        });
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 p-8 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Grand Archive Physical Collection & Deck Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Precision Inventory. Tournament Feasibility. Zero Shortage Surprises.
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            Track exact card printings, low publisher populations, cross-deck card sharing, and borrow idle copies from playgroup friends before events.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href="/collection"
              className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition-colors"
            >
              <Layers className="h-4 w-4" />
              <span>Open My Binder</span>
            </a>
            <a
              href="/decks"
              className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>Deck Builder & Shortages</span>
            </a>
            {!session?.user && (
              <a
                href="/login"
                className="flex items-center space-x-2 rounded-xl border border-indigo-500/40 bg-indigo-600/10 px-4 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In to Account</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="/collection?view=ALL"
          className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 hover:border-slate-700 hover:bg-slate-900 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Owned</span>
            <Layers className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {stats.totalCards.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-1">Physical copies registered</p>
        </a>

        <a
          href="/collection?view=LOW_POP"
          className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 hover:border-amber-500/40 hover:bg-amber-950/20 transition-all"
        >
          <div className="flex items-center justify-between text-amber-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Low Population</span>
            <ShieldAlert className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300">
            {stats.lowPopCount}
          </div>
          <p className="text-xs text-amber-400/80 mt-1">Rare collector printings (≤ 1,000)</p>
        </a>

        <a
          href="/collection?view=STAPLES"
          className="rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-5 hover:border-indigo-500/40 hover:bg-indigo-950/20 transition-all"
        >
          <div className="flex items-center justify-between text-indigo-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Multi-Deck Staples</span>
            <TrendingUp className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-300">
            {stats.staplesCount}
          </div>
          <p className="text-xs text-indigo-400/80 mt-1">Shared across 2+ active decks</p>
        </a>

        <a
          href="/collection?view=IDLE"
          className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-all"
        >
          <div className="flex items-center justify-between text-emerald-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Idle / Trade Binder</span>
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300">
            {stats.idleCount}
          </div>
          <p className="text-xs text-emerald-400/80 mt-1">Unassigned copies ready for trade</p>
        </a>
      </div>

      {/* Feature Showcase Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <a
          href="/catalog"
          className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-indigo-500/50 hover:bg-slate-900 transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between">
            <span>Card Catalog</span>
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-slate-400 mt-2">
            Explore all 2,535 Grand Archive cards with exact print editions, foil variants, and publisher population counts.
          </p>
        </a>

        <a
          href="/meta"
          className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-indigo-500/50 hover:bg-slate-900 transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20">
            <Trophy className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between">
            <span>Tournament Meta</span>
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-slate-400 mt-2">
            Inspect top tier archetypes from GrandArchiveStats and run instant shortage gap analysis against your inventory.
          </p>
        </a>

        <a
          href="/friends"
          className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-indigo-500/50 hover:bg-slate-900 transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between">
            <span>Playgroup Friends</span>
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-slate-400 mt-2">
            Connect via Friend Codes and discover who has idle copies of missing cards before your next tournament.
          </p>
        </a>
      </div>
    </div>
  );
}
