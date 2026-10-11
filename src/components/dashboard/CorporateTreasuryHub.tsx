"use client";

import { useState } from "react";
import ReconciliationTable from "./ReconciliationTable";
import TradFiConnector from '@/components/wallet/TradFiConnector';

export default function CorporateTreasuryHub() {
  const [dividendAmount, setDividendAmount] = useState("");
  const [splitRatio, setSplitRatio] = useState("2:1");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = (action: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      alert(`${action} execution broadcasted to Soroban network.`);
      setIsProcessing(false);
    }, 1500);
  };

  const handleDividend = async () => {
    if (!dividendAmount) return alert("Please enter a valid yield amount.");
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/treasury/disburse-dividend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: dividendAmount,
          asset: "USDC" // Asset matches the Symbol in Rust
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Yield Distributed & SEC Audit Logged.\nTX Hash: ${data.txHash}`);
      } else {
        alert(`Execution Failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Action error", error);
      alert("System error during dividend execution.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top-Level Equity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">Authorized TradFi Equity</p>
          <p className="text-2xl font-bold text-white mt-2">10,000,000 Class A</p>
          <p className="text-xs text-slate-500 mt-1">Custodian: SEC Regulated Brokerage</p>
        </div>
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">Mirrored on Stellar</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">1,450,000 ls-BRK</p>
          <p className="text-xs text-slate-500 mt-1">Contract ID: CABC...1234</p>
        </div>
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">Active Dividend Program</p>
            <p className="text-sm font-semibold text-indigo-400 mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Auto-Disburse USDC Yield
            </p>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Multi-Currency Claim Tracking Active</p>
        </div>
      </div>

      {/* Corporate Action Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dividend Distributor Engine */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-1">Dividend Issuance Engine</h3>
          <p className="text-xs text-slate-400 mb-5">Distribute USDC across on-chain token holders instantly.</p>
          
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-mono">Disbursement Asset</span>
              <span className="text-sm font-semibold text-white">USDC (Stellar Native)</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-mono">Total Yield Amount</span>
              <input 
                type="text" 
                placeholder="$500,000.00" 
                onChange={(e) => setDividendAmount(e.target.value)}
                className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
              />
            </div>
            <button 
  onClick={handleDividend}
  disabled={isProcessing}
  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
>
  AUTHORIZE & DISTRIBUTE YIELD
</button>
          </div>
        </div>

        {/* Stock Split / Smart Contract Logic */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-1">On-Chain Stock Split</h3>
          <p className="text-xs text-slate-400 mb-5">Execute an atomic forward or reverse split on the SAC contract.</p>
          
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-mono">Split Ratio</span>
              <select 
                value={splitRatio}
                onChange={(e) => setSplitRatio(e.target.value)}
                className="bg-transparent text-right text-sm font-semibold text-white outline-none"
              >
                <option value="2:1">2-for-1 Forward Split</option>
                <option value="3:1">3-for-1 Forward Split</option>
                <option value="1:2">1-for-2 Reverse Split</option>
              </select>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-mono">Target Network Block</span>
              <span className="text-sm font-mono text-emerald-400">Next Ledger Close (~5s)</span>
            </div>
            <button 
              onClick={() => handleAction(`Stock Split (${splitRatio})`)}
              disabled={isProcessing}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all border border-slate-700 disabled:opacity-50"
            >
              EXECUTE CORPORATE ACTION
            </button>
          </div>
        </div>

        {/* Institutional Fiat Gateway */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-1">Institutional Fiat Gateway</h3>
          <p className="text-xs text-slate-400 mb-5">Bind SEC-regulated bank reserves to your on-chain entity.</p>
          
          <div className="mt-auto pt-4">
            <TradFiConnector stellarDid="did:stellar:GB5MOCKDATA123" />
          </div>
        </div>
      </div>

      {/* The AI Reconciliation Oracle (Mint/Burn Engine) */}
      <div className="pt-2">
        <ReconciliationTable />
      </div>
    </div>
  );
}