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
    setTxStatus({ type: "loading", message: "Broadcasting to Stellar Mainnet..." });

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
    <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          Delta Reconciliation Oracle
          <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-[#000000] text-[#8E8E93] border border-[#2C2C2E] rounded">
            LIVE SOROBAN WASM
          </span>
        </h4>
        <span className="text-[10px] font-mono text-[#8E8E93] uppercase tracking-wider">Contract: CA3GET...VLS</span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <input 
          value={ticker} 
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          className="px-4 py-2.5 bg-[#000000] rounded-xl border border-[#2C2C2E] w-32 font-mono text-sm text-white focus:outline-none focus:border-[#34C759] transition-colors"
          placeholder="TICKER"
        />
        {isSyncing && livePrice === null && (
          <span className="text-xs font-mono text-[#8E8E93] animate-pulse">
            Connecting to Finnhub feed...
          </span>
        )}
      </div>

      {livePrice !== null && (
        <div className="mb-6 p-4 bg-[#000000] rounded-xl border border-[#2C2C2E]">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#8E8E93] font-mono text-xs uppercase">Market Price:</span>
            <span className="font-mono font-bold text-[#34C759] text-base">${livePrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-[#2C2C2E]">
            <span className="text-[#8E8E93] font-mono text-xs uppercase">Quantity to Settle:</span>
            <input 
              type="number" 
              value={quantity} 
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="px-2 py-1 bg-[#1C1C1E] rounded border border-[#2C2C2E] w-24 text-right font-mono text-white text-sm focus:outline-none focus:border-[#34C759]"
            />
          </div>
          <div className="flex justify-between items-center text-sm mt-3">
            <span className="text-[#8E8E93] font-mono text-xs uppercase">Calculated Value:</span>
            <span className="font-mono text-white">${(livePrice * quantity).toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleExecuteDelta}
        disabled={txStatus.type === "loading" || livePrice === null}
        className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
      >
        {txStatus.type === "loading" ? "Broadcasting..." : `EXECUTE DELTA (${quantity} ${ticker})`}
      </button>

      {txStatus.type !== "idle" && (
        <div className={`mt-4 p-4 rounded-xl border text-xs font-mono break-all flex flex-col gap-1 ${
          txStatus.type === "success" ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#34C759]" :
          txStatus.type === "error" ? "bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]" :
          "bg-[#1C1C1E] border-[#2C2C2E] text-white"
        }`}>
          <p>{txStatus.message}</p>
          {txStatus.hash && <p className="mt-1 text-[#8E8E93]">TX: {txStatus.hash}</p>}
        </div>
      )}
    </div>
  );
}