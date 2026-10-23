"use client";

import { useCallback, useEffect, useState } from "react";
import { network } from "@/lib/network";
import { readContract, sc } from "@/lib/soroban";

export interface ReserveProof {
  merkle_root: Uint8Array;
  reserves: bigint;
  supply: bigint;
  timestamp: bigint;
  ledger: number;
}

export interface LedgerState {
  name: string;
  symbol: string;
  totalSupply: bigint;
  splitRatio: [bigint, bigint];
  nonce: bigint;
  custodianBalance: bigint;
  marginBps: number;
  distributions: number;
  proof: ReserveProof | null;
  walletBalance: bigint | null;
  walletCompliant: boolean | null;
}

type LoadResult = { state: LedgerState | null; error: string | null };

async function fetchLedger(wallet: string | null): Promise<LoadResult> {
  const c = network.contracts;
  if (!network.deployed || !c.asset || !c.reconciliation || !c.yield || !c.solvency || !c.compliance) {
    return { state: null, error: null };
  }
  try {
    const [name, symbol, totalSupply, splitRatio, nonce, custodianBalance, marginBps, distributions, proof, walletBalance, walletCompliant] =
      await Promise.all([
        readContract<string>(c.asset, "name"),
        readContract<string>(c.asset, "symbol"),
        readContract<bigint>(c.asset, "total_supply"),
        readContract<[bigint, bigint]>(c.asset, "split_ratio"),
        readContract<bigint>(c.reconciliation, "nonce"),
        readContract<bigint>(c.reconciliation, "custodian_balance"),
        readContract<number>(c.yield, "margin_bps"),
        readContract<number>(c.yield, "distributions"),
        readContract<ReserveProof>(c.solvency, "latest").catch(() => null),
        wallet ? readContract<bigint>(c.asset, "balance", [sc.address(wallet)]) : Promise.resolve(null),
        wallet ? readContract<boolean>(c.compliance, "is_compliant", [sc.address(wallet)]) : Promise.resolve(null),
      ]);
    return {
      state: { name, symbol, totalSupply, splitRatio, nonce, custodianBalance, marginBps, distributions, proof, walletBalance, walletCompliant },
      error: null,
    };
  } catch (e) {
    return { state: null, error: (e as Error).message };
  }
}

/** Reads the live state of every LedgerSync contract via RPC simulation. */
export function useLedgerState(wallet: string | null) {
  const [result, setResult] = useState<LoadResult>({ state: null, error: null });
  const [loading, setLoading] = useState(true);

  const settle = useCallback((r: LoadResult) => {
    // Keep the last good state if a refresh fails transiently.
    setResult((prev) => (r.state || !prev.state ? r : { state: prev.state, error: r.error }));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLedger(wallet).then(settle);
  }, [wallet, settle]);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchLedger(wallet).then(settle);
  }, [wallet, settle]);

  return { state: result.state, error: result.error, loading, refresh };
}
