"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{t("table.title")}</h1>
      <p className="text-muted-foreground">{t("table.tagline")}</p>
      <Link
        href="/t/demo"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {t("table.createTable")}
      </Link>
      <p className="text-xs text-muted-foreground">{t("table.joinHint")}</p>
    </main>
  );
}
