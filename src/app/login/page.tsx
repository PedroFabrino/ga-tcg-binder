"use client";

import { useSession } from "next-auth/react";
import { CheckCircle2, Layers } from "lucide-react";
import SignInPanel from "@/components/SignInPanel";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();

  return (
    <div className="relative mx-auto my-8 max-w-lg sm:my-16">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative rounded-3xl glass-strong p-6 shadow-2xl sm:p-10 animate-fade-in">
        {status === "loading" ? (
          <div className="space-y-3"><div className="skeleton mx-auto h-12 w-12 rounded-2xl" /><div className="skeleton mx-auto h-6 w-48 rounded" /></div>
        ) : session?.user ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <h1 className="text-xl font-semibold text-white">{t("auth.signedInTitle")}</h1>
            <p className="text-sm text-slate-400">{t("auth.signedInAs", { name: session.user.name || "" })}</p>
            <Button asChild><a href="/collection">{t("auth.goToBinder")}</a></Button>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="foil-chip mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
                <Layers className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">{t("auth.welcomeTitle")}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{t("auth.welcomeSubtitle")}</p>
            </div>
            <SignInPanel callbackUrl="/collection" />
          </>
        )}
      </div>
    </div>
  );
}
