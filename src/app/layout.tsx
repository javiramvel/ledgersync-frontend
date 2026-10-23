import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "LedgerSync — Institutional Tokenization on Stellar",
  description:
    "Tokenize, reconcile and audit real-world assets on Stellar with Chainlink pricing and SEC 17a-4 WORM audit trails.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased dark:bg-neutral-950 dark:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
