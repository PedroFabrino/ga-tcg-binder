"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEMO_PROFILES = [
  { name: "Collector Alex", email: "alex@grandarchive.local", hint: "Seeded binder" },
  { name: "Collector Sarah", email: "sarah@grandarchive.local", hint: "Fresh binder" },
  { name: "Bob (Friend)", email: "bob@grandarchive.local", hint: "Playgroup friend" },
];

function DiscordIcon() {
  return (
    <svg className="h-5 w-5 fill-current" viewBox="0 0 127.14 96.36" aria-hidden="true">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export default function SignInPanel({ callbackUrl, onSignedIn }: { callbackUrl: string; onSignedIn?: () => void }) {
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const oauth = async (provider: "discord" | "google") => {
    setLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setLoading(null);
    }
  };

  const demo = async (name: string, email: string) => {
    setLoading(email);
    try {
      await signIn("demo-collector", { name, email, callbackUrl });
      onSignedIn?.();
    } catch {
      setLoading(null);
    }
  };

  const busy = Boolean(loading);

  return (
    <div className="space-y-3">
      <button onClick={() => oauth("discord")} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all hover:bg-[#4752C4] active:scale-[0.98] disabled:opacity-50">
        {loading === "discord" ? <Loader2 className="h-4 w-4 animate-spin" /> : <DiscordIcon/>} Continue with Discord
      </button>
      <button onClick={() => oauth("google")} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-all hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50">
        {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon/>} Continue with Google
      </button>

      <div className="flex items-center gap-3 py-2">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="label-caps !text-[10px]">Or try a demo collector</span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DEMO_PROFILES.map((p) => (
          <button
            key={p.email}
            onClick={() => demo(p.name, p.email)}
            disabled={busy}
            className="group flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-all hover:border-cyan-400/30 hover:bg-cyan-400/[0.05] disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-white">{p.name}</span>
              <span className="block text-[10px] text-slate-500">{p.hint}</span>
            </span>
            {loading === p.email ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300" />}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = customName.trim();
          if (!name) return;
          demo(name, `${name.toLowerCase().replace(/[^a-z0-9]/g, "") || "user"}@grandarchive.local`);
        }}
        className="flex gap-2"
      >
        <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Or enter any collector name" aria-label="Custom collector name" />
        <Button type="submit" disabled={busy || !customName.trim()} variant="outline" className="shrink-0">Enter</Button>
      </form>
    </div>
  );
}
