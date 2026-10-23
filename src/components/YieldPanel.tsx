"use client";

import { useState } from "react";
import { network, requireContract } from "@/lib/network";
import { fromUnits, toUnits } from "@/lib/format";
import { readContract, sc } from "@/lib/soroban";
import type { LedgerState } from "./useLedgerState";
import { useTransaction, useWallet } from "./WalletProvider";
import { Button, Card, Field, Stat, TxNotice } from "./ui";

interface Holder {
  address: string;
  balance: bigint;
}

export function YieldPanel({ ledger, onChange }: { ledger: LedgerState; onChange: () => void }) {
  const { address, isAdmin } = useWallet();
  const tx = useTransaction(onChange);
  const [gross, setGross] = useState("100");
  const [holderInput, setHolderInput] = useState("");
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  let grossUnits: bigint | null = null;
  try {
    grossUnits = toUnits(gross);
  } catch {
    grossUnits = null;
  }
  const margin = grossUnits !== null ? (grossUnits * BigInt(ledger.marginBps)) / 10_000n : null;
  const covered = holders?.reduce((s, h) => s + h.balance, 0n) ?? 0n;
  const complete = holders !== null && covered === ledger.totalSupply && ledger.totalSupply > 0n;

  async function loadHolders() {
    const list = Array.from(new Set((holderInput || address || "").split(/[\s,]+/).filter(Boolean)));
    setChecking(true);
    setCheckError(null);
    try {
      const asset = requireContract("asset");
      const balances = await Promise.all(list.map((a) => readContract<bigint>(asset, "balance", [sc.address(a)])));
      setHolders(list.map((a, i) => ({ address: a, balance: balances[i] })));
    } catch (e) {
      setHolders(null);
      setCheckError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Routing margin" value={`${(ledger.marginBps / 100).toFixed(2)}%`} detail={`${ledger.marginBps} bps to LedgerSync treasury`} />
        <Stat label="Distributions executed" value={ledger.distributions} detail="On-chain counter" />
        <Stat label="Eligible supply" value={fromUnits(ledger.totalSupply)} detail={ledger.symbol} />
      </div>

      <Card title="Distribute yield" subtitle={`Pays a dividend or coupon pro-rata to every holder in one atomic transaction. Payout asset: native XLM (SAC) on ${network.label}.`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Gross payout (XLM)" inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} />
          <Field
            label="Holder wallets"
            placeholder={address ?? "G…, G…"}
            value={holderInput}
            onChange={(e) => {
              setHolderInput(e.target.value);
              setHolders(null);
            }}
            hint="Must cover 100% of supply. Defaults to the connected wallet."
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {margin !== null && grossUnits !== null
              ? `Holders receive ${fromUnits(grossUnits - margin, 7)} XLM · margin ${fromUnits(margin, 7)} XLM`
              : "Enter a valid amount."}
          </p>
          <div className="flex gap-2">
            <Button variant="quiet" onClick={loadHolders} busy={checking}>
              Check cap table
            </Button>
            <Button
              variant="success"
              disabled={!isAdmin || !complete || grossUnits === null}
              busy={tx.state.kind === "pending"}
              onClick={() =>
                tx.run("Yield distribution", requireContract("yield"), "distribute", [
                  sc.address(network.contracts.payoutToken),
                  sc.i128(grossUnits!),
                  sc.addresses(holders!.map((h) => h.address)),
                ], "yield")
              }
            >
              Distribute
            </Button>
          </div>
        </div>

        {checkError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{checkError}</p>}
        {holders && (
          <ul className="mt-4 divide-y divide-slate-200/70 rounded-xl bg-slate-50 px-4 text-sm dark:divide-white/5 dark:bg-black/30">
            {holders.map((h) => (
              <li key={h.address} className="flex justify-between py-2 font-mono text-xs">
                <span className="truncate">{h.address}</span>
                <span className="tabular-nums">{fromUnits(h.balance)} ({ledger.totalSupply > 0n ? Number((h.balance * 10_000n) / ledger.totalSupply) / 100 : 0}%)</span>
              </li>
            ))}
            <li className={`py-2 text-xs ${complete ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}>
              {complete ? "Cap table covers the full supply." : `Covers ${fromUnits(covered)} of ${fromUnits(ledger.totalSupply)}; add the missing holders.`}
            </li>
          </ul>
        )}
        <TxNotice state={tx.state} />
      </Card>
    </div>
  );
}
