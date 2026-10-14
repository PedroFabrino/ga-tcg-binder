"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { X, LogIn, Sparkles, User, Loader2, ArrowRight } from "lucide-react";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const [collectorName, setCollectorName] = useState("Collector Alex");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleOAuthSignIn = async (provider: "discord" | "google") => {
    setLoadingProvider(provider);
    try {
      await signIn(provider, { callbackUrl: window.location.href });
    } catch (err) {
      console.error(`${provider} sign in error:`, err);
      setLoadingProvider(null);
    }
  };

  const handleDemoSignIn = async (name: string, email: string) => {
    setLoadingProvider("demo");
    try {
      await signIn("demo-collector", {
        name,
        email,
        callbackUrl: window.location.href,
      });
      onClose();
    } catch (err) {
      console.error("Demo sign in error:", err);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Collector Sign In</h2>
            <p className="text-xs text-slate-400">
              Access your personal binder, manage decks, and connect with playgroup friends.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Discord Login Button */}
          <button
            onClick={() => handleOAuthSignIn("discord")}
            disabled={Boolean(loadingProvider)}
            className="w-full flex items-center justify-center space-x-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] py-2.5 px-4 text-sm font-semibold text-white shadow-md transition-all disabled:opacity-50"
          >
            {loadingProvider === "discord" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5 fill-current" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
            )}
            <span>Continue with Discord</span>
          </button>

          {/* Google Login Button */}
          <button
            onClick={() => handleOAuthSignIn("google")}
            disabled={Boolean(loadingProvider)}
            className="w-full flex items-center justify-center space-x-3 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 py-2.5 px-4 text-sm font-semibold text-slate-200 shadow-md transition-all disabled:opacity-50"
          >
            {loadingProvider === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500 font-semibold">Or Instant Playgroup Access</span>
            </div>
          </div>

          {/* Instant Playgroup Profile Switcher / Quick Sign In */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-400">
              <Sparkles className="h-4 w-4" />
              <span>1-Click Playgroup Sign-In</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDemoSignIn("Alex (You)", "alex@grandarchive.local")}
                disabled={Boolean(loadingProvider)}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs font-medium text-slate-200 hover:border-indigo-500 hover:bg-slate-800/80 transition-all text-left"
              >
                <div>
                  <div className="font-bold text-white">Alex</div>
                  <div className="text-[10px] text-slate-400">GA-ALEX01</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
              </button>

              <button
                onClick={() => handleDemoSignIn("Bob (Friend)", "bob@grandarchive.local")}
                disabled={Boolean(loadingProvider)}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs font-medium text-slate-200 hover:border-indigo-500 hover:bg-slate-800/80 transition-all text-left"
              >
                <div>
                  <div className="font-bold text-white">Bob</div>
                  <div className="text-[10px] text-slate-400">GA-BOB77</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
              </button>
            </div>

            <div className="pt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Or enter any custom name..."
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() =>
                    handleDemoSignIn(
                      collectorName.trim() || "Collector",
                      `${collectorName.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "user"}@grandarchive.local`
                    )
                  }
                  disabled={Boolean(loadingProvider)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  Enter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
