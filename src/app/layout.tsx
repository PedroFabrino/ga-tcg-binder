import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { CardHoverProvider } from "@/components/CardHoverPreview";

export const metadata: Metadata = {
  title: "GA TCG Binder — Tournament Collection & Deck Manager",
  description: "Track physical Grand Archive TCG collections, low population prints, deck shortages, and playgroup idle cards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#070a11] text-slate-200 min-h-screen flex flex-col grain">
        <AuthProvider>
          <ToastProvider>
            <CardHoverProvider>
              <Navbar />
              <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </main>
            </CardHoverProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
