"use client";

import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Layers,
  Sparkles,
  Trophy,
  Users,
  QrCode,
  Settings as SettingsIcon,
} from "lucide-react";
import QrScanModal from "./QrScanModal";
import SettingsModal from "./SettingsModal";

export default function Navbar() {
  const pathname = usePathname();
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Scan with Phone</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
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
    </>
  );
}
