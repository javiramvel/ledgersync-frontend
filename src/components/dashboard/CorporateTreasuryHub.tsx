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
          asset: "USDC" 
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
        <div className="p-5 bg-[#1C1C1E]/50 border border-[#2C2C2E] rounded-2xl shadow-lg relative overflow-hidden transition-all duration-300 hover:border-[#3A3A3C]">
          <p className="text-xs text-[#8E8E93] uppercase font-mono tracking-wider">Authorized TradFi Equity</p>
          <p className="text-2xl font-bold text-white mt-2">10,000,000 Class A</p>
          <p className="text-xs text-[#8E8E93] mt-1">Custodian: SEC Regulated Brokerage</p>
        </div>
        <div className="p-5 bg-[#1C1C1E]/50 border border-[#2C2C2E] rounded-2xl shadow-lg relative overflow-hidden transition-all duration-300 hover:border-[#3A3A3C]">
          <p className="text-xs text-[#8E8E93] uppercase font-mono tracking-wider">Mirrored on Stellar</p>
          <p className="text-2xl font-bold text-[#34C759] mt-2">1,450,000 ls-BRK</p>
          <p className="text-xs text-[#8E8E93] mt-1">Contract ID: CABC...1234</p>
        </div>
        <div className="p-5 bg-[#1C1C1E]/50 border border-[#2C2C2E] rounded-2xl shadow-lg flex flex-col justify-between transition-all duration-300 hover:border-[#3A3A3C]">
          <div>
            <p className="text-xs text-[#8E8E93] uppercase font-mono tracking-wider">Active Dividend Program</p>
            <p className="text-sm font-semibold text-[#5E5CE6] mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5E5CE6] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5E5CE6]"></span>
              </span>
              Auto-Disburse USDC Yield
            </p>
          </div>
          <p className="text-[10px] text-[#8E8E93] mt-2">Multi-Currency Claim Tracking Active</p>
        </div>
      </div>

      {/* Corporate Action Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dividend Distributor Engine */}
        <div className="bg-[#000000] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-300 hover:border-[#3A3A3C]">
          <h3 className="text-lg font-semibold text-white mb-1">Dividend Issuance Engine</h3>
          <p className="text-xs text-[#8E8E93] mb-5">Distribute USDC across on-chain token holders instantly.</p>
          
          <div className="space-y-4">
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-[#8E8E93] font-mono">Disbursement Asset</span>
              <span className="text-sm font-semibold text-white">USDC (Stellar Native)</span>
            </div>
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-[#8E8E93] font-mono">Total Yield Amount</span>
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
              className="w-full bg-[#5E5CE6] hover:bg-[#5E5CE6]/80 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              AUTHORIZE & DISTRIBUTE YIELD
            </button>
          </div>
        </div>

        {/* Stock Split / Smart Contract Logic */}
        <div className="bg-[#000000] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-300 hover:border-[#3A3A3C]">
          <h3 className="text-lg font-semibold text-white mb-1">On-Chain Stock Split</h3>
          <p className="text-xs text-[#8E8E93] mb-5">Execute an atomic forward or reverse split on the SAC contract.</p>
          
          <div className="space-y-4">
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-[#8E8E93] font-mono">Split Ratio</span>
              <select 
                value={splitRatio}
                onChange={(e) => setSplitRatio(e.target.value)}
                className="bg-transparent text-right text-sm font-semibold text-white outline-none cursor-pointer"
              >
                <option value="2:1" className="bg-[#000000]">2-for-1 Forward Split</option>
                <option value="3:1" className="bg-[#000000]">3-for-1 Forward Split</option>
                <option value="1:2" className="bg-[#000000]">1-for-2 Reverse Split</option>
              </select>
            </div>
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-[#8E8E93] font-mono">Target Network Block</span>
              <span className="text-sm font-mono text-[#34C759]">Next Ledger Close (~5s)</span>
            </div>
            <button 
              onClick={() => handleAction(`Stock Split (${splitRatio})`)}
              disabled={isProcessing}
              className="w-full bg-[#1C1C1E] hover:bg-[#2C2C2E] text-white font-bold py-3 rounded-xl transition-all border border-[#2C2C2E] disabled:opacity-50 cursor-pointer"
            >
              EXECUTE CORPORATE ACTION
            </button>
          </div>
        </div>

        {/* Institutional Fiat Gateway */}
        <div className="bg-[#000000] border border-[#2C2C2E] rounded-2xl p-6 flex flex-col transition-all duration-300 hover:border-[#3A3A3C]">
          <h3 className="text-lg font-semibold text-white mb-1">Institutional Fiat Gateway</h3>
          <p className="text-xs text-[#8E8E93] mb-5">Bind SEC-regulated bank reserves to your on-chain entity.</p>
          
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