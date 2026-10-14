"use client";

import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  User,
} from "lucide-react";
import QrScanModal from "./QrScanModal";
import SettingsModal from "./SettingsModal";
import LoginModal from "./LoginModal";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const navItems = [
    { href: "/collection", label: "My Collection", icon: Layers },
    { href: "/decks", label: "Decks & Shortages", icon: BookOpen },
    { href: "/catalog", label: "Card Catalog", icon: Sparkles },
    { href: "/meta", label: "Meta Explorer", icon: Trophy },
    { href: "/friends", label: "Friends", icon: Users },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center space-x-6">
            <a href="/" className="flex items-center space-x-2 text-indigo-400 hover:text-indigo-300">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 border border-indigo-500/30 font-bold text-indigo-400">
                GA
              </div>
              <span className="font-semibold tracking-wide text-white text-lg">
                TCG Binder
              </span>
            </a>

            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setShowQrModal(true)}
              className="hidden sm:flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <QrCode className="h-4 w-4" />
              <span>Scan with Phone</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>

            {/* Authentication Button / User Profile */}
            {session?.user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2 rounded-xl border border-slate-800 bg-slate-900/90 py-1 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-850 hover:border-slate-700 transition-all"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/30 text-[11px] font-bold text-indigo-300">
                    {session.user.name?.charAt(0).toUpperCase() || "C"}
                  </div>
                  <span className="hidden sm:inline font-semibold">{session.user.name || "Collector"}</span>
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50 divide-y divide-slate-800">
                    <div className="px-3 py-2 text-xs">
                      <div className="font-bold text-white truncate">{session.user.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{session.user.email}</div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowSettingsModal(true);
                        }}
                        className="w-full flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 text-left"
                      >
                        <SettingsIcon className="h-3.5 w-3.5" />
                        <span>Collector Settings</span>
                      </button>
                    </div>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          signOut();
                        }}
                        className="w-full flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/30 text-left"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center space-x-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/10 hover:bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:text-white transition-all shadow-sm"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-slate-800/80 px-2 py-1.5 justify-around bg-slate-950/90 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1 px-2 rounded ${
                  isActive ? "text-indigo-400 font-medium" : "text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                <span>{item.label.split(" ")[0]}</span>
              </a>
            );
          })}
        </div>
      </header>

      {showQrModal && <QrScanModal onClose={() => setShowQrModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
}
