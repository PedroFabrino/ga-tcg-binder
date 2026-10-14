"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  BookOpen, Layers, Sparkles, Trophy, Users, QrCode, Settings as SettingsIcon,
  LogIn, LogOut, Menu, X, Search, Command, ChevronDown, Copy, Home,
} from "lucide-react";
import QrScanModal from "./QrScanModal";
import SettingsModal from "./SettingsModal";
import LoginModal from "./LoginModal";
import CommandPalette from "./CommandPalette";
import { useToast } from "./ToastProvider";

const NAV_ITEMS = [
  { href: "/collection", label: "Collection", icon: Layers },
  { href: "/decks", label: "Decks", icon: BookOpen },
  { href: "/catalog", label: "Catalog", icon: Sparkles },
  { href: "/meta", label: "Meta", icon: Trophy },
  { href: "/friends", label: "Friends", icon: Users },
];

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
  const [friendCode, setFriendCode] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCmdk(true);
      }
      if (e.key === "Escape") {
        setShowUserDropdown(false);
        setMobileOpen(false);
      }
    };
    const openScanner = () => setShowQrModal(true);
    const openSettings = () => setShowSettingsModal(true);
    const openLogin = () => setShowLoginModal(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-scanner", openScanner);
    window.addEventListener("open-settings", openSettings);
    window.addEventListener("open-login", openLogin);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-scanner", openScanner);
      window.removeEventListener("open-settings", openSettings);
      window.removeEventListener("open-login", openLogin);
    };
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user?.friendCode && setFriendCode(d.user.friendCode))
      .catch(() => {});
  }, [session?.user?.email]);

  useEffect(() => setMobileOpen(false), [pathname]);

  const copyFriendCode = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      showToast("Friend Code Copied", "success");
    } catch {
      showToast("Could not access clipboard", "error");
    }
  };

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070a11]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <a href="/" className="group flex items-center gap-2.5" aria-label="GA TCG Binder home">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/25 bg-gradient-to-br from-amber-200/15 to-amber-500/5 shadow-[0_0_16px_-6px_rgba(232,201,103,0.6)] transition-shadow group-hover:shadow-[0_0_20px_-4px_rgba(232,201,103,0.8)]">
                <span className="text-sm font-black tracking-tighter text-amber-200">GA</span>
              </div>
              <div className="hidden sm:block">
                <span className="block text-sm font-semibold leading-tight tracking-tight text-white">TCG Binder</span>
                <span className="block text-[10px] leading-tight text-slate-500">Grand Archive</span>
              </div>
            </a>

            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-all ${
                    isActive(href)
                      ? "border-white/[0.08] bg-white/[0.06] text-white"
                      : "border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCmdk(true)}
              aria-label="Open quick search"
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-slate-400 transition-all hover:bg-white/[0.05] hover:text-slate-200"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search cards...</span>
              <kbd className="hidden items-center gap-0.5 rounded border border-white/10 px-1 py-0.5 font-mono text-[10px] text-slate-500 lg:flex">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>

            <button onClick={() => setShowQrModal(true)} className="btn-accent !px-3 !py-1.5 !text-xs" aria-label="Scan cards with phone">
              <QrCode className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scan with Phone</span>
            </button>

            {session?.user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={showUserDropdown}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1 pl-1 pr-2 text-xs font-medium transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 text-[11px] font-bold text-amber-200">
                    {session.user.name?.charAt(0).toUpperCase() || "C"}
                  </div>
                  <span className="hidden font-medium text-slate-200 sm:inline">{session.user.name?.split(" ")[0] || "Collector"}</span>
                  <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${showUserDropdown ? "rotate-180" : ""}`} />
                </button>

                {showUserDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />
                    <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-xl glass-strong p-1.5 shadow-2xl animate-modal">
                      <div className="border-b border-white/[0.06] px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                          <span className="truncate text-sm font-semibold text-white">{session.user.name}</span>
                        </div>
                        <div className="truncate font-mono text-[11px] text-slate-500">{session.user.email}</div>
                      </div>
                      {friendCode && (
                        <button
                          onClick={copyFriendCode}
                          className="mx-1.5 my-2 flex w-[calc(100%-12px)] items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                        >
                          <div>
                            <div className="label-caps !text-[9px]">Friend Code</div>
                            <div className="font-mono text-sm font-semibold text-amber-200">{friendCode}</div>
                          </div>
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      )}
                      <button
                        role="menuitem"
                        onClick={() => { setShowUserDropdown(false); setShowSettingsModal(true); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-white/[0.04]"
                      >
                        <SettingsIcon className="h-3.5 w-3.5" />
                        Collector Preferences
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setShowUserDropdown(false); signOut(); showToast("Signed out", "info"); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-rose-400 transition-colors hover:bg-rose-500/10"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="hidden rounded-lg p-2 text-slate-400 transition-all hover:bg-white/[0.04] hover:text-slate-200 sm:block"
                  aria-label="Preferences"
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
                <button onClick={() => setShowLoginModal(true)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              </>
            )}

            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? "" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <div
          className={`absolute inset-0 bg-[#05070c]/70 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col glass-strong transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <span className="label-caps">Navigate</span>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {[{ href: "/", label: "Dashboard", icon: Home }, ...NAV_ITEMS].map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : isActive(href);
              return (
                <a
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2 border-t border-white/[0.06] p-4">
            <button onClick={() => { setMobileOpen(false); setShowSettingsModal(true); }} className="btn-ghost w-full">
              <SettingsIcon className="h-4 w-4" /> Preferences
            </button>
          </div>
        </aside>
      </div>

      {showQrModal && <QrScanModal onClose={() => setShowQrModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {showCmdk && <CommandPalette onClose={() => setShowCmdk(false)} />}
    </>
  );
}
