import "./globals.css";
import type { Metadata } from "next";
import { enCatalog } from "@ga/contracts";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: enCatalog.table.title,
  description: enCatalog.table.tagline,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
