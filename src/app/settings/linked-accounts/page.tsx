"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/common";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SettingsLinkedAccountsSection } from "@/components/settings/SettingsLinkedAccountsSection";

export default function LinkedAccountsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 pb-12 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        <Link href="/settings">
          {t("settings.backLink")}
        </Link>
      </div>

      <PageHeader
        eyebrow={t("settings.pageEyebrow")}
        title={t("settings.linkedAccountsTitle")}
        description={t("settings.linkedAccountsDesc")}
      />

      <SettingsLinkedAccountsSection hideHeader />
    </div>
  );
}
