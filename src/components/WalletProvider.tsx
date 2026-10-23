"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { xdr } from "@stellar/stellar-sdk";
import { archiveTransaction } from "@/app/actions/audit";
import { network } from "@/lib/network";
import { connectFreighter, currentAddress, invoke } from "@/lib/wallet";
import type { TxState } from "./ui";

interface WalletContextValue {
  address: string | null;
  isAdmin: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentAddress().then(setAddress).catch(() => undefined);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      setAddress(await connectFreighter());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const value: WalletContextValue = {
    address,
    isAdmin: Boolean(address && address === network.admin),
    connecting,
    error,
    connect,
    disconnect: () => setAddress(null),
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

/**
 * Runs one signed contract call end to end: Freighter signature, ledger confirmation, then
 * server-side verification and archival to the 17a-4 WORM bucket.
 */
export function useTransaction(onConfirmed?: () => void) {
  const { address } = useWallet();
  const [state, setState] = useState<TxState>({ kind: "idle" });

  const run = useCallback(
    async (label: string, contractId: string, method: string, args: xdr.ScVal[], scope?: string) => {
      if (!address) {
        setState({ kind: "error", message: "Connect Freighter first." });
        return null;
      }
      try {
        setState({ kind: "pending", message: `${label}: approve in Freighter…` });
        const result = await invoke(address, contractId, method, args, scope);
        setState({ kind: "pending", message: `${label}: confirmed. Archiving audit record…` });
        const archive = await archiveTransaction(result.hash);
        setState({
          kind: "success",
          message: `${label} confirmed on ${network.label}.`,
          hash: result.hash,
          archived: archive.ok ? "17a-4 record archived (WORM)" : `Audit archive pending: ${archive.error}`,
        });
        onConfirmed?.();
        return result;
      } catch (e) {
        setState({ kind: "error", message: (e as Error).message });
        return null;
      }
    },
    [address, onConfirmed],
  );

  return { state, run, setState };
}
