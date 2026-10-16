import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.scanner) {
    notFound();
  }

  return <>{children}</>;
}
