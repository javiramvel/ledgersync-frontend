import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Using Inter as it closely mirrors Apple's SF Pro font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ledger-Sync Treasury",
  description: "Institutional Asset Management Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning is required for next-themes to work smoothly
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white transition-colors duration-300`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
