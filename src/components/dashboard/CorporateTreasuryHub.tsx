"use client";

import { useState } from "react";
import TradFiConnector from "@/components/wallet/TradFiConnector";
import ReconciliationTable from "@/components/dashboard/ReconciliationTable";

interface CorporateTreasuryHubProps {
  onSuccessAction?: (txHash: string) => void;
}

export default function CorporateTreasuryHub({ onSuccessAction }: CorporateTreasuryHubProps) {
  const [isDistributing, setIsDistributing] = useState(false);
  const [isExecutingSplit, setIsExecutingSplit] = useState(false);
  const [splitRatio, setSplitRatio] = useState("2-for-1 Forward Split");
  const [dividendAmount, setDividendAmount] = useState("500,000.00");
  const [disbursementAsset, setDisbursementAsset] = useState("USDC (Stellar Native)");

  const handleDividendPayout = async () => {
    setIsDistributing(true);
    try {
      const res = await fetch("/api/treasury/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "distribute_dividends",
          ticker: "USDC",
          amount: 500000,
          targetAddress: "GAMKTQOJDGQKQWIF7VDUMBPALB73T663B3TURUQS3NVL6NZJK5F5Y35J",
        }),
      });
      const data = await res.json();
      if (data.success && data.txHash) {
        if (onSuccessAction) onSuccessAction(data.txHash);
        alert(`Dividend Distribution Complete: TX ${data.txHash.slice(0, 10)}...`);
      } else {
        alert(`Distribution Failed: ${data.error || "Simulation error"}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsDistributing(false);
    }
  };

  const handleStockSplit = async () => {
    setIsExecutingSplit(true);
    try {
      const res = await fetch("/api/treasury/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute_split",
          ticker: "AAPL",
          amount: 2,
          targetAddress: "GAMKTQOJDGQKQWIF7VDUMBPALB73T663B3TURUQS3NVL6NZJK5F5Y35J",
        }),
      });
      const data = await res.json();
      if (data.success && data.txHash) {
        if (onSuccessAction) onSuccessAction(data.txHash);
        alert(`Corporate Action Executed: TX ${data.txHash.slice(0, 10)}...`);
      } else {
        alert(`Stock Split Failed: ${data.error || "Simulation error"}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsExecutingSplit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]">
          <p className="text-[11px] font-mono tracking-wider text-[#8E8E93] uppercase">Authorized TradFi Equity</p>
          <p className="text-2xl font-bold text-white mt-1">10,000,000 Class A</p>
          <p className="text-xs text-[#8E8E93] mt-1 font-mono">Custodian: SEC Regulated Brokerage</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]">
          <p className="text-[11px] font-mono tracking-wider text-[#8E8E93] uppercase">Mirrored on Stellar</p>
          <p className="text-2xl font-bold text-[#34C759] mt-1">1,450,000 ls-BRK</p>
          <p className="text-xs text-[#8E8E93] mt-1 font-mono">Contract ID: CABC...1234</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]">
          <p className="text-[11px] font-mono tracking-wider text-[#8E8E93] uppercase">Active Dividend Program</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse"></span>
            <p className="text-sm font-semibold text-white">Auto-Disburse USDC Yield</p>
          </div>
          <p className="text-xs text-[#8E8E93] mt-1 font-mono">Multi-Currency Claim Tracking Active</p>
        </div>
      </div>

      {/* Corporate Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dividend Issuance */}
        <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] flex flex-col justify-between">
          <div>
            <h4 className="text-base font-semibold text-white">Dividend Issuance Engine</h4>
            <p className="text-xs text-[#8E8E93] mt-1">Distribute USDC across on-chain token holders instantly.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-[#8E8E93]">Disbursement Asset</label>
                <div className="mt-1 p-2.5 rounded-xl bg-[#000000] border border-[#2C2C2E] text-xs font-mono text-white">
                  {disbursementAsset}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-[#8E8E93]">Total Yield Amount</label>
                <div className="mt-1 p-2.5 rounded-xl bg-[#000000] border border-[#2C2C2E] text-xs font-mono text-white">
                  ${dividendAmount}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleDividendPayout}
            disabled={isDistributing}
            className="mt-6 w-full py-3 px-4 rounded-xl bg-[#34C759] hover:bg-[#34C759]/90 text-black font-semibold text-xs tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#34C759]/10"
          >
            {isDistributing ? "Broadcasting Payout..." : "Authorize & Distribute Yield"}
          </button>
        </div>

        {/* Stock Split */}
        <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] flex flex-col justify-between">
          <div>
            <h4 className="text-base font-semibold text-white">On-Chain Stock Split</h4>
            <p className="text-xs text-[#8E8E93] mt-1">Execute an atomic forward or reverse split on the SAC contract.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-[#8E8E93]">Split Ratio</label>
                <select
                  value={splitRatio}
                  onChange={(e) => setSplitRatio(e.target.value)}
                  className="mt-1 w-full p-2.5 rounded-xl bg-[#000000] border border-[#2C2C2E] text-xs text-white font-mono focus:outline-none focus:border-[#34C759]"
                >
                  <option>2-for-1 Forward Split</option>
                  <option>3-for-1 Forward Split</option>
                  <option>1-for-2 Reverse Split</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-[#8E8E93]">Target Network Block</label>
                <div className="mt-1 p-2.5 rounded-xl bg-[#000000] border border-[#2C2C2E] text-xs font-mono text-[#34C759]">
                  Next Ledger Close (~5s)
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleStockSplit}
            disabled={isExecutingSplit}
            className="mt-6 w-full py-3 px-4 rounded-xl bg-[#000000] hover:bg-[#2C2C2E] text-white border border-[#2C2C2E] font-semibold text-xs tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isExecutingSplit ? "Executing Split..." : "Execute Corporate Action"}
          </button>
        </div>

        {/* Institutional Fiat Gateway (Plaid Brokerage Bridge) */}
        <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] flex flex-col justify-between">
          <div>
            <h4 className="text-base font-semibold text-white">Institutional Fiat Gateway</h4>
            <p className="text-xs text-[#8E8E93] mt-1">Bind SEC-regulated bank reserves to your on-chain entity.</p>
            <div className="mt-6 p-4 rounded-xl bg-[#000000] border border-[#2C2C2E]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8E8E93]">Settlement Account</span>
                <span className="text-white">JPMorgan Chase ****8821</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-2">
                <span className="text-[#8E8E93]">Status</span>
                <span className="text-[#34C759] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]"></span> Ready for Bridge
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <TradFiConnector stellarDid="GAMKTQOJDGQKQWIF7VDUMBPALB73T663B3TURUQS3NVL6NZJK5F5Y35J" />
          </div>
        </div>
      </div>

      {/* Delta Reconciliation Table */}
      <ReconciliationTable />
    </div>
  );
}