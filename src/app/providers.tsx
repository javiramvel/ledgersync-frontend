"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { WalletProvider } from "@/components/WalletProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <WalletProvider>{children}</WalletProvider>
    </ThemeProvider>
  );
}
