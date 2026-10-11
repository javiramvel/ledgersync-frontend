"use client";

import { useState, useEffect } from "react";

interface ReconciliationDelta {
  id: string;
  ticker: string;
  tradFiQuantity: number;
  onChainBalance: number;
  delta: number;
  action: "MINT" | "BURN" | "SYNCED";
  targetAddress: string;
}

export default function ReconciliationTable({ accessToken }: { accessToken?: string }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [deltas, setDeltas] = useState<ReconciliationDelta[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, string>>({});

  const fetchDeltas = async () => {
    setIsSyncing(true);
    setTimeout(() => {
      setDeltas([
        // Using "deployer" as the targetAddress so the local Stellar CLI resolves it correctly
        { id: "REC-001", ticker: "AAPL", tradFiQuantity: 5050, onChainBalance: 5000, delta: 50, action: "MINT", targetAddress: "deployer" },
        { id: "REC-002", ticker: "TSLA", tradFiQuantity: 2980, onChainBalance: 3000, delta: -20, action: "BURN", targetAddress: "deployer" },
        { id: "REC-003", ticker: "USDC", tradFiQuantity: 50000, onChainBalance: 50000, delta: 0, action: "SYNCED", targetAddress: "deployer" },
      ]);
      setIsSyncing(false);
    }, 1500);
  };

  useEffect(() => {
    fetchDeltas();
  }, [accessToken]);

  const handleExecute = async (item: ReconciliationDelta) => {
    if (item.action === "SYNCED") return;
    
    setProcessingId(item.id);

    try {
      const contractAction = item.action === "MINT" ? "mint_asset" : "burn_asset";

      const res = await fetch("/api/treasury/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: contractAction,
          ticker: item.ticker,
          amount: Math.abs(item.delta),
          targetAddress: item.targetAddress, 
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setReceipts((prev) => ({ ...prev, [item.id]: data.txHash }));
        setDeltas((prev) =>
          prev.map((record) =>
            record.id === item.id
              ? { ...record, onChainBalance: record.tradFiQuantity, delta: 0, action: "SYNCED" }
              : record
          )
        );
      } else {
        alert(`Reconciliation Execution Failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error(error);
      alert("Network error occurred during reconciliation broadcast.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden mt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
              Oracle Engine 3
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700 rounded">
              DTCC Sync
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight mt-1">
            AI Delta Reconciliation (Mint / Burn)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronize on-chain circulating supply with SEC-regulated TradFi custodian balances.
          </p>
        </div>
        <button
          onClick={fetchDeltas}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSyncing ? (
            <span className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-white rounded-full"></span>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {isSyncing ? "SYNCING..." : "REFRESH ORACLE"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/50 text-xs uppercase font-mono text-slate-500 border-b border-slate-800">
            <tr>
              <th className="px-6 py-4 font-medium">Asset</th>
              <th className="px-6 py-4 font-medium text-right">TradFi Qty</th>
              <th className="px-6 py-4 font-medium text-right">On-Chain Qty</th>
              <th className="px-6 py-4 font-medium text-right">Target Delta</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {deltas.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-xs">
                  {isSyncing ? "Analyzing cross-chain parity..." : "Awaiting brokerage connection..."}
                </td>
              </tr>
            ) : (
              deltas.map((item) => {
                const isLoading = processingId === item.id;
                const txHash = receipts[item.id];
                const isSynced = item.action === "SYNCED";

                return (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">
                      {item.ticker}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                      {item.tradFiQuantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                      {item.onChainBalance.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={item.action === "MINT" ? "text-emerald-400" : item.action === "BURN" ? "text-rose-400" : "text-slate-500"}>
                        {item.delta > 0 ? "+" : ""}{item.delta === 0 ? "0" : item.delta.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {txHash ? (
                        <div className="flex flex-col items-end gap-1 text-xs font-mono">
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            ✓ SEC 17a-4 Logged
                          </span>
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                          >
                            {txHash.substring(0, 12)}...
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleExecute(item)}
                          disabled={isLoading || isSynced}
                          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ease-out shadow-sm ml-auto flex items-center gap-2
                            ${isSynced 
                              ? "bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700"
                              : isLoading
                              ? "bg-indigo-600/50 text-indigo-200 cursor-not-allowed border border-indigo-500/50"
                              : item.action === "MINT" 
                              ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/50" 
                              : "bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/50"}`}
                        >
                          {isLoading ? (
                            <>
                              <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                              SYNCING...
                            </>
                          ) : isSynced ? (
                            "PARITY REACHED"
                          ) : (
                            `EXECUTE ${item.action}`
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}