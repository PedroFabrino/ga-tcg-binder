"use client";

import { useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export default function TablePage() {
  const { t } = useTranslation();
  const params = useParams<{ code: string }>();
  const code = params?.code ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        {t("table.roomCode")}: <span className="font-mono">{code}</span>
      </p>
      <p className="text-muted-foreground">{t("table.comingSoon")}</p>
    </main>
  );
}
