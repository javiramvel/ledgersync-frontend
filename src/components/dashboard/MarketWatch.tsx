"use client";

import { useState, useEffect } from "react";
import { useMarketData } from "@/lib/MarketDataContext";

const TRACKED_ASSETS = [
  { ticker: "XLM", type: "On-Chain Asset", defaultPrice: 0.1142, defaultChange: 3.25 },
  { ticker: "AAPL", type: "On-Chain Asset", defaultPrice: 188.52, defaultChange: -0.49 },
  { ticker: "TSLA", type: "On-Chain Asset", defaultPrice: 214.10, defaultChange: -1.15 },
  { ticker: "USDC", type: "Stablecoin", defaultPrice: 1.00, defaultChange: 0.00 },
];

export default function MarketWatch({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { marketData } = useMarketData();
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    // Update the timestamp strictly when global Finnhub market data changes
    if (Object.keys(marketData).length > 0) {
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [marketData]);

  return (
    <div className="w-full bg-[#000000] rounded-3xl border border-[#2C2C2E] overflow-hidden shadow-sm transition-all duration-500">
      
      {/* Real-Time Ticker Strip */}
      <div className="w-full bg-[#1C1C1E] py-2 overflow-hidden flex border-b border-[#2C2C2E] relative">
        <div className="absolute left-4 top-2 text-[10px] text-[#8E8E93] z-10 bg-[#000000] px-2 rounded-full border border-[#2C2C2E]">
          ● LIVE (FINNHUB: {lastUpdated || "Syncing..."})
        </div>
        <div className="animate-marquee pl-40 flex items-center">
          {[...TRACKED_ASSETS, ...TRACKED_ASSETS].map((asset, idx) => {
            const liveData = marketData[asset.ticker];
            const price = liveData?.price ?? asset.defaultPrice;
            const change = liveData?.change ?? asset.defaultChange;
            const isPositive = change >= 0;

            return (
              <div key={`${asset.ticker}-${idx}`} className="flex items-center space-x-3 px-6 border-r border-[#2C2C2E] text-xs font-medium font-mono">
                <span className="text-white">{asset.ticker}</span>
                <span className="text-[#8E8E93]">${price.toFixed(2)}</span>
                <span className={isPositive ? "text-[#34C759]" : "text-[#FF3B30]"}>
                  {isPositive ? "+" : ""}{change.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic View Area */}
      <div className="p-6">
        <h2 className="text-2xl font-semibold text-white mb-6">
          {isAuthenticated ? "Your LedgerSync Portfolio" : "Global Secondary Market"}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TRACKED_ASSETS.slice(0, isAuthenticated ? 2 : 4).map((asset) => {
            const liveData = marketData[asset.ticker];
            const price = liveData?.price ?? asset.defaultPrice;
            const change = liveData?.change ?? asset.defaultChange;
            const isPositive = change >= 0;

            return (
              <div key={asset.ticker} className="p-4 rounded-2xl bg-[#1C1C1E]/50 border border-[#2C2C2E] hover:bg-[#1C1C1E] transition-colors cursor-pointer flex justify-between items-center hover:border-[#3A3A3C]">
                <div>
                  <p className="text-lg font-bold text-white">{asset.ticker}</p>
                  <p className="text-xs text-[#8E8E93]">{asset.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-mono text-white">${price.toFixed(2)}</p>
                  <p className={`text-sm font-semibold font-mono ${isPositive ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                    {isPositive ? "+" : ""}{change.toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}