"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      {children}
    </main>
  );
}

export function TableLoading() {
  const { t } = useTranslation();
  return (
    <TableShell>
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    </TableShell>
  );
}

export function TableNoSeat({ code }: { code: string }) {
  const { t } = useTranslation();

  return (
    <TableShell>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("table.title")}</h1>
        <span className="font-mono text-sm text-muted-foreground">{code}</span>
      </header>
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t("table.noSeatTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("table.noSeatHint")}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("table.backHome")}
        </Link>
      </section>
    </TableShell>
  );
}
