"use client";

import { useState } from "react";

export default function AtomicSwapAction() {
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const handleSwap = async () => {
    setIsSwapping(true);
    setReceipt(null);
    
    // In production, this triggers retail-atomic-swap.js 
    // requiring both parties (or the AMM pool) to sign the transaction.
    await new Promise(resolve => setTimeout(resolve, 3000)); 
    
    setReceipt("9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f");
    setIsSwapping(false);
  };

  return (
    <div className="p-5 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-200/50 dark:border-white/5 mt-6 transition-all">
      <h3 className="text-lg font-bold mb-1">
        Secondary Market
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
        Execute a zero-counterparty atomic swap. Settlement is T+0.
      </p>
      
      <div className="space-y-4 relative">
        
        {/* Sell Container */}
        <div className="p-4 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
            You Pay
          </label>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-semibold">5,000</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-sm font-medium">
              USDC
            </span>
          </div>
        </div>

        {/* Swap Icon (Visual Only) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-100 dark:bg-[#2C2C2E] border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center z-10 shadow-sm">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
          </svg>
        </div>

        {/* Buy Container */}
        <div className="p-4 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
            You Receive
          </label>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-semibold text-green-600 dark:text-green-400">50</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-white rounded-lg text-sm font-medium">
              REFA
            </span>
          </div>
        </div>

        {!receipt ? (
          <button
            onClick={handleSwap}
            disabled={isSwapping}
            // Apple HIG: Blue primary action button
            className="w-full py-3.5 px-4 mt-4 bg-blue-600 text-white font-semibold rounded-xl transition-all duration-200 ease-out hover:bg-blue-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSwapping ? "Clearing Trade..." : "Confirm Atomic Swap"}
          </button>
        ) : (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-md space-y-2">
            <p className="text-green-700 dark:text-green-400 text-sm font-semibold">
              ✅ Trade Settled Instantly
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-xs truncate font-mono bg-white/50 dark:bg-black/50 p-2 rounded-lg border border-slate-200 dark:border-white/5">
              Hash: {receipt}
            </p>
            <p className="text-xs text-slate-500 pt-1">
              Assets have been securely transferred to your wallet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
