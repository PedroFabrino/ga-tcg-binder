"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  BookOpen, Layers, Sparkles, Trophy, Users, Store, QrCode, Settings as SettingsIcon,
  LogIn, LogOut, Menu, Search, Command, ChevronDown, Copy, Home,
} from "lucide-react";
import QrScanModal from "./QrScanModal";
import SettingsModal from "./SettingsModal";
import LoginModal from "./LoginModal";
import CommandPalette from "./CommandPalette";
import { useToast } from "./ToastProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/collection", label: "Collection", icon: Layers },
  { href: "/decks", label: "Decks", icon: BookOpen },
  { href: "/marketplace", label: "Marketplace", icon: Store },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCmdk, setShowCmdk] = useState(false);
  const [friendCode, setFriendCode] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCmdk(true);
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

            <Button onClick={() => setShowQrModal(true)} variant="accent" size="sm" aria-label="Scan cards with phone">
              <QrCode className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scan with Phone</span>
            </Button>

            {session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1 pl-1 pr-2 text-xs font-medium transition-all hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 text-[11px] font-bold text-amber-200">
                      {session.user.name?.charAt(0).toUpperCase() || "C"}
                    </div>
                    <span className="hidden font-medium text-slate-200 sm:inline">{session.user.name?.split(" ")[0] || "Collector"}</span>
                    <ChevronDown className="h-3 w-3 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                      <span className="truncate text-sm font-semibold text-white">{session.user.name}</span>
                    </div>
                    <div className="truncate font-mono text-[11px] font-normal text-slate-500">{session.user.email}</div>
                  </DropdownMenuLabel>
                  {friendCode && (
                    <DropdownMenuItem
                      onSelect={copyFriendCode}
                      className="my-1.5 justify-between border border-white/[0.06] bg-white/[0.03]"
                    >
                      <div>
                        <div className="label-caps !text-[9px]">Friend Code</div>
                        <div className="font-mono text-sm font-semibold text-amber-200">{friendCode}</div>
                      </div>
                      <Copy className="text-slate-400" />
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setShowSettingsModal(true)} className="text-xs">
                    <SettingsIcon />
                    Collector Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => { signOut(); showToast("Signed out", "info"); }}
                    className="text-xs text-rose-400 data-[highlighted]:bg-rose-500/10 data-[highlighted]:text-rose-300"
                  >
                    <LogOut />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button onClick={() => setShowSettingsModal(true)} variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Preferences">
                  <SettingsIcon className="h-4 w-4" />
                </Button>
                <Button onClick={() => setShowLoginModal(true)} variant="outline" size="sm">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </>
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent aria-describedby={undefined}>
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <SheetTitle className="label-caps">Navigate</SheetTitle>
                </div>
                <nav className="flex flex-col gap-1 p-3" aria-label="Mobile navigation">
                  {[{ href: "/", label: "Dashboard", icon: Home }, ...NAV_ITEMS].map(({ href, label, icon: Icon }) => {
                    const active = href === "/" ? pathname === "/" : isActive(href);
                    return (
                      <a
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
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
                  <Button onClick={() => { setMobileOpen(false); setShowSettingsModal(true); }} variant="outline" className="w-full">
                    <SettingsIcon className="h-4 w-4" /> Preferences
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {showQrModal && <QrScanModal onClose={() => setShowQrModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {showCmdk && <CommandPalette onClose={() => setShowCmdk(false)} />}
    </>
  );
}
