import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { FlightModeProvider } from "@/context/FlightModeContext";

export const metadata: Metadata = {
  title: "StayFinder — AI-Powered Hotel Discovery & Booking",
  description:
    "Discover exceptional hotels, heritage havelis, and luxury resorts across India with Gemini AI-powered natural search, grounded concierge, and vibe matching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <FlightModeProvider>
          <CurrencyProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
          </CurrencyProvider>
        </FlightModeProvider>

        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-white font-heading font-extrabold text-lg">
              <span className="bg-brand-600 px-2.5 py-1 rounded-xl text-xs uppercase tracking-wider">
                StayFinder
              </span>
              <span>Hospitality Intelligence</span>
            </div>
            <p className="text-xs text-slate-500">
              © 2026 StayFinder Inc. Built with Next.js 14, FastAPI & Google Gemini.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
