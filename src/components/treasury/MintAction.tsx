"use client";

import { useState } from "react";
// Import the Server Action
import { executeMintingTransaction } from "@/app/actions/stellar";

export default function MintAction() {
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [shares, setShares] = useState<string>("10000");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMint = async () => {
    setIsMinting(true);
    setReceipt(null);
    setError(null);
    
    try {
      // Call the Next.js Server Action
      const response = await executeMintingTransaction(shares);
      
      if (response.success && response.hash) {
        setReceipt(response.hash);
      } else {
        setError(response.error || "Execution failed.");
      }
    } catch (err) {
      setError("An unexpected error occurred while communicating with the server.");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-200/50 dark:border-white/5 mt-6 transition-all">
      <h3 className="text-xl font-semibold mb-2">
        Issue Tokenized Securities
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Mint new SEC-compliant shares to the corporate treasury. AUTH_REQUIRED and AUTH_REVOCABLE flags are automatically enforced.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Asset Class
          </label>
          <input 
            disabled 
            value="REFA (Real Estate Fund A)" 
            className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Amount to Mint
          </label>
          <input 
            type="number" 
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="w-full bg-white dark:bg-black/60 border border-slate-200 dark:border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
          />
        </div>

        {!receipt ? (
          <button
            onClick={handleMint}
            disabled={isMinting}
            className="w-full py-3 px-4 mt-2 bg-green-600 text-white font-medium rounded-xl transition-all duration-200 ease-out hover:bg-green-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isMinting ? "Executing Smart Contract..." : "Mint Shares to Treasury"}
          </button>
        ) : (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl backdrop-blur-md space-y-2">
            <p className="text-blue-700 dark:text-blue-400 text-sm font-semibold">
              ✅ Transaction Confirmed on Stellar
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-xs truncate font-mono bg-white/50 dark:bg-black/50 p-2 rounded-lg border border-slate-200 dark:border-white/5">
              Hash: {receipt}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 pt-1">
              AWS Fargate WORM audit log generated.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-500 font-medium">
            Error: {error}
          </p>
        )}
      </div>
    </div>
  );
}
