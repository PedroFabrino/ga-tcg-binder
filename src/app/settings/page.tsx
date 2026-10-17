"use client";

import { useRouter } from "next/navigation";
import SettingsModal from "@/components/SettingsModal";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
      <SettingsModal onClose={() => router.push("/decks?view=shortages")} />
    </div>
  );
}
