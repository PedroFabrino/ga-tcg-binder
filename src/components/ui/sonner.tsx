"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      duration={3500}
      toastOptions={{
        classNames: {
          toast: "glass-strong !rounded-xl !border-white/[0.08] !bg-[#0b0f19]/90 !text-slate-200 !shadow-2xl !shadow-black/60 backdrop-blur-xl",
          description: "!text-slate-400",
          success: "[&_[data-icon]]:!text-emerald-400",
          error: "[&_[data-icon]]:!text-rose-400",
          info: "[&_[data-icon]]:!text-sky-400",
        },
      }}
    />
  );
}
