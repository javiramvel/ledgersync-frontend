"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { network } from "@/lib/network";
import { shortId } from "@/lib/format";
import { useWallet } from "./WalletProvider";
import { Badge, Button } from "./ui";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // false during SSR, true on the client: avoids a theme-icon hydration mismatch.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      className="rounded-xl p-2 text-slate-600 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-200/70 hover:shadow-lg dark:text-slate-300 dark:hover:bg-white/10"
    >
      {mounted ? (dark ? "☀︎" : "☾") : <span className="inline-block w-3" />}
    </button>
  );
}

export function Header() {
  const { address, isAdmin, connecting, error, connect, disconnect } = useWallet();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-black">
            LS
          </div>
          <span className="font-semibold tracking-tight">LedgerSync</span>
          <Badge tone={network.name === "mainnet" ? "green" : "amber"}>{network.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {address ? (
            <>
              {isAdmin && <Badge tone="blue">Issuer admin</Badge>}
              <Button variant="quiet" onClick={disconnect} title={address}>
                <span className="font-mono">{shortId(address)}</span>
              </Button>
            </>
          ) : (
            <Button onClick={connect} busy={connecting}>
              Connect Freighter
            </Button>
          )}
        </div>
      </div>
      {error && <p className="bg-red-500/10 px-6 py-2 text-center text-sm text-red-700 dark:text-red-300">{error}</p>}
    </header>
  );
}
