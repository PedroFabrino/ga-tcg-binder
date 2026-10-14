"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  BookOpen,
  Layers,
  Sparkles,
  Trophy,
  Users,
  QrCode,
  Settings as SettingsIcon,
  LogIn,
  LogOut,
  Menu,
  X,
  Search,
  Command,
  ChevronDown,
  Zap,
} from "lucide-react";
import QrScanModal from "./QrScanModal";
import SettingsModal from "./SettingsModal";
import LoginModal from "./LoginModal";
import CommandPalette from "./CommandPalette";
import { useToast } from "./ToastProvider";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCmdk, setShowCmdk] = useState(false);

  const navItems = [
    { href: "/collection", label: "Collection", icon: Layers, short: "Binder" },
    { href: "/decks", label: "Decks", icon: BookOpen, short: "Decks" },
    { href: "/catalog", label: "Catalog", icon: Sparkles, short: "Catalog" },
    { href: "/meta", label: "Meta", icon: Trophy, short: "Meta" },
    { href: "/friends", label: "Friends", icon: Users, short: "Friends" },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCmdk(true);
      }
      if (e.key === "Escape") {
        setShowCmdk(false);
        setShowUserDropdown(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070a11]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Left: Logo + Nav */}
          <div className="flex items-center space-x-8">
            <a href="/" className="flex items-center space-x-2.5 group">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/20">
                <span className="text-sm font-black text-indigo-300 tracking-tighter">GA</span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent to-indigo-500/5 group-hover:to-indigo-500/10 transition-all" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold tracking-tight text-white text-sm leading-tight block">TCG Binder</span>
                <span className="text-[10px] text-slate-500 leading-tight block">Grand Archive</span>
              </div>
            </a>

            <nav className="hidden md:flex items-center space-x-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                      isActive
                        ? "bg-white/[0.06] text-white border border-white/[0.08]"
                        : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-2">
            {/* Command Palette Trigger */}
            <button
              onClick={() => setShowCmdk(true)}
              className="hidden sm:flex items-center space-x-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-all"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search...</span>
              <kbd className="hidden lg:flex items-center gap-0.5 rounded border border-white/10 px-1 py-0.5 text-[10px] font-mono text-slate-500">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>

            {/* Scan Button */}
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-400 hover:to-indigo-500 transition-all"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scan</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-all"
              title="Settings"
              aria-label="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>

            {/* Auth */}
            {session?.user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1 pl-1 pr-2 text-xs font-medium hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500/30 to-indigo-600/10 text-[11px] font-bold text-indigo-300 border border-indigo-500/20">
                    {session.user.name?.charAt(0).toUpperCase() || "C"}
                  </div>
                  <span className="hidden sm:inline font-medium text-slate-200">{session.user.name?.split(" ")[0] || "Collector"}</span>
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </button>

                {showUserDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-56 rounded-xl glass-strong p-1.5 shadow-2xl z-50 animate-modal">
                      <div className="px-3 py-2.5 border-b border-white/[0.06]">
                        <div className="font-semibold text-white text-sm truncate">{session.user.name}</div>
                        <div className="text-[11px] text-slate-500 truncate font-mono">{session.user.email}</div>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => { setShowUserDropdown(false); setShowSettingsModal(true); }}
                          className="w-full flex items-center space-x-2.5 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.04] text-left transition-colors"
                        >
                          <SettingsIcon className="h-3.5 w-3.5" />
                          <span>Collector Settings</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            signOut();
                            showToast("Signed out successfully", "info");
                          }}
                          className="w-full flex items-center space-x-2.5 rounded-lg px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 text-left transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center space-x-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-all"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden rounded-lg p-2 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#070a11]/95 backdrop-blur-xl animate-fade-in">
            <nav className="flex flex-col px-3 py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center space-x-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive ? "bg-white/[0.06] text-white" : "text-slate-400 hover:bg-white/[0.03]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {showQrModal && <QrScanModal onClose={() => setShowQrModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {showCmdk && <CommandPalette onClose={() => setShowCmdk(false)} />}
    </>
  );
}
