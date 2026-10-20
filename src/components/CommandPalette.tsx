"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Layers,
  BookOpen,
  Sparkles,
  Trophy,
  Users,
  Store,
  QrCode,
  Settings as SettingsIcon,
  LogIn,
  Home,
  CornerDownLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FEATURES } from "@/lib/features";

interface CommandItem {
  label: string;
  icon: any;
  action: () => void;
  group: string;
  keywords?: string;
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [hasVendorCapability, setHasVendorCapability] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((settings: { hasVendorCapability?: boolean }) => {
        setHasVendorCapability(settings.hasVendorCapability === true);
      })
      .catch(() => undefined);
  }, []);

  const commands: CommandItem[] = [
    { label: "Go to Dashboard", icon: Home, action: () => router.push("/"), group: "Navigation" },
    { label: "Open My Binder", icon: Layers, action: () => router.push("/collection"), group: "Navigation", keywords: "collection inventory" },
    { label: "Deck Builder", icon: BookOpen, action: () => router.push("/decks"), group: "Navigation", keywords: "shortage decks" },
    { label: "MyP Marketplace", icon: Store, action: () => router.push("/marketplace"), group: "Navigation", keywords: "myp mypcards store listings shortage market" },
    ...(hasVendorCapability ? [{ label: "MyP Store (Personal)", icon: Store, action: () => router.push("/collection?view=MYP_STORE"), group: "Navigation", keywords: "myp store sales selling binder sync" }] : []),
    { label: "Card Catalog", icon: Sparkles, action: () => router.push("/catalog"), group: "Navigation", keywords: "search cards" },
    { label: "Tournament Meta Explorer", icon: Trophy, action: () => router.push("/meta"), group: "Navigation", keywords: "archetypes grandarchivestats" },
    { label: "Playgroup Friends", icon: Users, action: () => router.push("/friends"), group: "Navigation", keywords: "friend code idle" },
    ...(FEATURES.scanner
      ? [{ label: "Scan with Phone", icon: QrCode, action: () => { window.dispatchEvent(new CustomEvent("open-scanner")); }, group: "Actions" }]
      : []),
    { label: "Collector Settings & Superfrete API", icon: SettingsIcon, action: () => router.push("/settings"), group: "Navigation", keywords: "settings superfrete api key shipping credentials token preferences low pop" },
    { label: "Sign In", icon: LogIn, action: () => router.push("/login"), group: "Actions" },
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords?.toLowerCase().includes(q) ||
      cmd.group.toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const flatFiltered = Object.values(grouped).flat();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flatFiltered[selectedIdx];
      if (cmd) {
        cmd.action();
        onClose();
      }
    }
  };

  let runningIdx = 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose aria-describedby={undefined} onKeyDown={handleKeyDown} className="sm:top-[20vh] sm:max-w-xl sm:translate-y-0">
        <DialogTitle className="sr-only">Quick search</DialogTitle>
        <div className="flex items-center space-x-3 border-b border-white/[0.06] px-4 py-3.5">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {flatFiltered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No results found</div>
          ) : (
            Object.entries(grouped).map(([group, cmds]) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {group}
                </div>
                {cmds.map((cmd) => {
                  const idx = runningIdx++;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={cmd.label}
                      onClick={() => { cmd.action(); onClose(); }}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        isSelected ? "bg-white/[0.06] text-white" : "text-slate-400 hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <cmd.icon className="h-4 w-4 text-slate-500" />
                        <span>{cmd.label}</span>
                      </div>
                      {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-slate-500" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
