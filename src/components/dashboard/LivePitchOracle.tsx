// src/components/dashboard/LivePitchOracle.tsx
"use client";

import { useState } from "react";
import { useMarketData } from "@/lib/MarketDataContext";
import { executeLedgerSync } from "@/lib/soroban";

export default function LivePitchOracle() {
  const { marketData } = useMarketData();
  const [ticker, setTicker] = useState("AAPL");
  const [quantity, setQuantity] = useState(10);
  const [txStatus, setTxStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string; hash?: string }>({ type: "idle", message: "" });

  const feed = marketData[ticker];
  const livePrice = feed?.price ?? null;
  const isSyncing = feed?.isSyncing ?? true;

  const handleExecuteDelta = async () => {
    setTxStatus({ type: "loading", message: "Requesting Freighter signature on Stellar Testnet..." });

    try {
      const result = await executeLedgerSync("SYNC_STATE", ticker, quantity);

      if (result.success) {
        setTxStatus({ 
          type: "success", 
          message: "Delta synchronized and verified on-chain.", 
          hash: result.txHash 
        });
      } else {
        setTxStatus({ type: "error", message: `Reverted: ${result.error}` });
      }
    } catch (err: any) {
      setTxStatus({ type: "error", message: `Execution failed: ${err.message || "Unknown error"}` });
    }
  };

  return (
    <div className="p-6 border rounded-2xl bg-slate-900/80 border-slate-800 text-white shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          Delta Reconciliation Oracle
          <span className="px-2 py-0.5 text-[9px] font-mono tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
            LIVE SOROBAN WASM
          </span>
        </h2>
        <span className="text-xs font-mono text-slate-500">Contract: CA3GET...VLS</span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <input 
          value={ticker} 
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          className="px-4 py-2 bg-slate-950 rounded-lg border border-slate-700 w-32 font-mono text-sm focus:outline-none focus:border-indigo-500"
          placeholder="TICKER"
        />
        {isSyncing && livePrice === null && (
          <span className="text-xs font-mono text-slate-500 animate-pulse">
            Connecting to Finnhub feed...
          </span>
        )}
      </div>

      {livePrice !== null && (
        <div className="mb-5 p-4 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Market Price:</span>
            <span className="font-mono font-bold text-emerald-400 text-base">${livePrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-slate-800/60">
            <span className="text-slate-400">Quantity to Settle:</span>
            <input 
              type="number" 
              value={quantity} 
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="px-2 py-1 bg-slate-900 rounded border border-slate-700 w-24 text-right font-mono text-white text-sm"
            />
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-slate-400">Calculated Value:</span>
            <span className="font-mono text-slate-200">${(livePrice * quantity).toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleExecuteDelta}
        disabled={txStatus.type === "loading" || livePrice === null}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-mono text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20"
      >
        {txStatus.type === "loading" ? "Broadcasting to Ledger..." : `EXECUTE DELTA (${quantity} ${ticker})`}
      </button>

      {txStatus.type !== "idle" && (
        <div className={`mt-4 p-3 border rounded-lg text-xs font-mono break-all ${
          txStatus.type === "success" ? "bg-emerald-950/30 border-emerald-800 text-emerald-300" :
          txStatus.type === "error" ? "bg-red-950/30 border-red-800 text-red-300" :
          "bg-slate-950 border-slate-800 text-slate-300"
        }`}>
          <p>{txStatus.message}</p>
          {txStatus.hash && <p className="mt-1 opacity-75">TX: {txStatus.hash}</p>}
        </div>
      )}
    </div>
  );
}