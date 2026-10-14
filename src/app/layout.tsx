import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Grand Archive TCG Binder & Deck Manager",
  description: "Track physical collections, low population prints, deck shortages, and playgroup idle cards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
