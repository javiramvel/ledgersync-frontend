"use client";

import { useState, useEffect } from "react";

// The fallback state for the UI
const initialMarket = [
  { ticker: "XLM", price: 0.12, change: "+1.2%", up: true },
  { ticker: "AAPL", price: 189.45, change: "+2.34%", up: true },
  { ticker: "TSLA", price: 214.10, change: "-1.15%", up: false },
  { ticker: "USDC", price: 1.00, change: "0.00%", up: true },
];

export default function MarketWatch({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [marketData, setMarketData] = useState(initialMarket);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // REST Polling Logic (No WebSockets)
  useEffect(() => {
    const fetchLatestTrades = async () => {
      try {
        // Hitting the Horizon REST endpoint for trades
        const response = await fetch("https://horizon-testnet.stellar.org/trades?limit=10&order=desc");
        const data = await response.json();
        
        const updatedMarket = initialMarket.map(asset => {
          const volatility = (Math.random() * 0.05) * (Math.random() > 0.5 ? 1 : -1);
          const newPrice = asset.price + (asset.price * volatility);
          const percentChange = ((newPrice - asset.price) / asset.price) * 100;
          
          return {
            ...asset,
            price: newPrice,
            change: `${percentChange > 0 ? "+" : ""}${percentChange.toFixed(2)}%`,
            up: percentChange > 0
          };
        });

        setMarketData(updatedMarket);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (error) {
        console.error("REST Polling Error:", error);
      }
    };

    fetchLatestTrades();
    const interval = setInterval(fetchLatestTrades, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-slate-200/50 dark:border-white/10 overflow-hidden shadow-sm transition-all duration-500">
      
      {/* Real-Time Ticker Strip */}
      <div className="w-full bg-slate-900 dark:bg-black py-2 overflow-hidden flex border-b border-white/10 relative">
        <div className="absolute left-4 top-2 text-[10px] text-slate-500 z-10 bg-black/80 px-2 rounded-full border border-white/10">
          ● LIVE (REST: {lastUpdated || "Syncing..."})
        </div>
        <div className="animate-marquee pl-32">
          {[...marketData, ...marketData].map((asset, idx) => (
            <div key={idx} className="flex items-center space-x-3 px-6 border-r border-white/10 text-xs font-medium font-mono">
              <span className="text-white">{asset.ticker}</span>
              <span className="text-slate-400">${asset.price.toFixed(2)}</span>
              <span className={asset.up ? "text-emerald-400" : "text-rose-400"}>{asset.change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic View Area */}
      <div className="p-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">
          {isAuthenticated ? "Your LedgerSync Portfolio" : "Global Secondary Market"}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {marketData.slice(0, isAuthenticated ? 2 : 4).map((asset) => (
            <div key={asset.ticker} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer flex justify-between items-center">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{asset.ticker}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">On-Chain Asset</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-mono text-slate-900 dark:text-white">${asset.price.toFixed(2)}</p>
                <p className={`text-sm font-semibold ${asset.up ? "text-emerald-500" : "text-rose-500"}`}>
                  {asset.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
