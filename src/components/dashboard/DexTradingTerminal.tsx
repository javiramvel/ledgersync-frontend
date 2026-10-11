// src/components/dashboard/DexTradingTerminal.tsx
"use client";

import { useState, useMemo } from "react";
import { useOrderBook } from "@/hooks/useOrderBook";

// Configuration for LedgerSync Testnet Integration
const BASE_ASSET = { code: "ls-BRK", issuer: "GBBD47IF6LWK7P7MDEVSCWTTCJM4RTOC6SPUGN5PZHKK34NRA762BDDF" }; 
const QUOTE_ASSET = { code: "XLM", issuer: "" };

export default function DexTradingTerminal() {
  const [buyPrice, setBuyPrice] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellAmount, setSellAmount] = useState("");

  const [isSubmittingBuy, setIsSubmittingBuy] = useState(false);
  const [isSubmittingSell, setIsSubmittingSell] = useState(false);
  const [tradeMessage, setTradeMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const { bids, asks, isLoading } = useOrderBook(
    BASE_ASSET.code,
    BASE_ASSET.issuer,
    QUOTE_ASSET.code,
    QUOTE_ASSET.issuer
  );

  const { displayAsks, displayBids, maxVolume, spread, midPrice } = useMemo(() => {
    const topAsks = asks.slice(0, 6);
    const topBids = bids.slice(0, 6);

    const maxAskTotal = topAsks.length > 0 ? topAsks[topAsks.length - 1].total || 0 : 0;
    const maxBidTotal = topBids.length > 0 ? topBids[topBids.length - 1].total || 0 : 0;
    const maxVol = Math.max(maxAskTotal, maxBidTotal) || 1; 

    let currentSpread = "0.00";
    let currentMid = "0.00";

    if (topAsks.length > 0 && topBids.length > 0) {
      const lowestAsk = parseFloat(topAsks[0].price);
      const highestBid = parseFloat(topBids[0].price);
      currentSpread = (lowestAsk - highestBid).toFixed(4);
      currentMid = ((lowestAsk + highestBid) / 2).toFixed(2);
    }

    return {
      displayAsks: topAsks.reverse(),
      displayBids: topBids,
      maxVolume: maxVol,
      spread: currentSpread,
      midPrice: currentMid,
    };
  }, [asks, bids]);

  const handleRowClick = (price: string, setPriceFn: (p: string) => void) => {
    setPriceFn(parseFloat(price).toFixed(4));
  };

  const executeOrder = async (side: "BUY" | "SELL") => {
    const price = side === "BUY" ? buyPrice : sellPrice;
    const amount = side === "BUY" ? buyAmount : sellAmount;
    
    if (!price || !amount || parseFloat(price) <= 0 || parseFloat(amount) <= 0) {
      setTradeMessage({ type: "error", text: `Invalid ${side} parameters. Price and amount must be greater than zero.` });
      return;
    }

    setTradeMessage(null);
    if (side === "BUY") setIsSubmittingBuy(true);
    else setIsSubmittingSell(true);

    try {
      const res = await fetch("/api/treasury/execute-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          baseAsset: BASE_ASSET,
          quoteAsset: QUOTE_ASSET,
          price: parseFloat(price),
          amount: parseFloat(amount)
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Execution rejected by network (Status ${res.status})`);
      }

      const data = await res.json();
      setTradeMessage({ type: "success", text: `${side} order broadcast successfully. TX: ${data.txHash || 'Confirmed'}` });
      
      if (side === "BUY") { setBuyPrice(""); setBuyAmount(""); }
      else { setSellPrice(""); setSellAmount(""); }
      
    } catch (error) {
      setTradeMessage({ type: "error", text: String(error) });
    } finally {
      if (side === "BUY") setIsSubmittingBuy(false);
      else setIsSubmittingSell(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-1 rounded-3xl">
      
      {/* Left Side: Order Book (4 Cols) */}
      <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
          <h3 className="text-sm font-semibold text-white">Order Book (SDEX)</h3>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 ${
            isLoading ? "text-slate-400 bg-slate-800/50" : "text-emerald-400 bg-emerald-400/10"
          }`}>
            {!isLoading && <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></span>}
            {isLoading ? "SYNCING..." : "LIVE"}
          </span>
        </div>

        <div className="text-[10px] font-mono text-slate-500 flex justify-between px-2 mb-2 uppercase tracking-wider">
          <span>Price ({QUOTE_ASSET.code})</span>
          <span>Size ({BASE_ASSET.code})</span>
          <span>Total</span>
        </div>

        {/* Asks */}
        <div className="space-y-0.5 mb-3 flex-1 flex flex-col justify-end">
          {displayAsks.length === 0 && !isLoading && (
            <div className="text-center text-xs text-slate-600 py-2">No sell orders</div>
          )}
          {displayAsks.map((ask, idx) => {
            const depthPct = ((ask.total || 0) / maxVolume) * 100;
            return (
              <div 
                key={`ask-${idx}`} 
                onClick={() => handleRowClick(ask.price, setBuyPrice)}
                className="relative flex justify-between text-xs font-mono px-2 py-1 group cursor-pointer hover:bg-slate-800/50"
              >
                <div className="absolute right-0 top-0 bottom-0 bg-rose-500/10 z-0 transition-all duration-300" style={{ width: depthPct + "%" }}></div>
                <span className="text-rose-400 z-10">{parseFloat(ask.price).toFixed(4)}</span>
                <span className="text-slate-300 z-10">{parseFloat(ask.amount).toFixed(2)}</span>
                <span className="text-slate-500 z-10">{ask.total?.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Spread Indicator */}
        <div className="py-2 flex items-center justify-between border-y border-slate-800 mb-3 px-2 bg-slate-950/30">
          <span className="text-lg font-bold text-white tracking-tight">
            {displayAsks.length && displayBids.length ? `${midPrice}` : "---"}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Spread: {spread}
          </span>
        </div>

        {/* Bids */}
        <div className="space-y-0.5 flex-1">
          {displayBids.length === 0 && !isLoading && (
            <div className="text-center text-xs text-slate-600 py-2">No buy orders</div>
          )}
          {displayBids.map((bid, idx) => {
            const depthPct = ((bid.total || 0) / maxVolume) * 100;
            return (
              <div 
                key={`bid-${idx}`} 
                onClick={() => handleRowClick(bid.price, setSellPrice)}
                className="relative flex justify-between text-xs font-mono px-2 py-1 group cursor-pointer hover:bg-slate-800/50"
              >
                <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 z-0 transition-all duration-300" style={{ width: depthPct + "%" }}></div>
                <span className="text-emerald-400 z-10">{parseFloat(bid.price).toFixed(4)}</span>
                <span className="text-slate-300 z-10">{parseFloat(bid.amount).toFixed(2)}</span>
                <span className="text-slate-500 z-10">{bid.total?.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Side: Execution Engine (8 Cols) */}
      <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Berkshire Hathaway Inc. Mirror</h2>
              <p className="text-sm text-slate-400 font-mono mt-1">Stellar Contract: {BASE_ASSET.issuer.substring(0,8)}...{BASE_ASSET.issuer.substring(BASE_ASSET.issuer.length - 4)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-300">Available Balance</p>
              <p className="text-xl font-mono text-indigo-400 mt-0.5">142.50 {QUOTE_ASSET.code}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Buy Interface */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
              <div className="flex justify-between mb-4">
                <span className="text-sm font-semibold text-emerald-400">Buy {BASE_ASSET.code}</span>
                <span className="text-xs text-slate-500 font-mono">Limit</span>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-mono">Price</span>
                  <input 
                    type="number" 
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="0.0000" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-mono">Amount</span>
                  <input 
                    type="number" 
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.00" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono pr-1">
                  Total: {buyPrice && buyAmount ? (parseFloat(buyPrice) * parseFloat(buyAmount)).toFixed(4) : "0.0000"} {QUOTE_ASSET.code}
                </div>
                <button 
                  onClick={() => executeOrder("BUY")}
                  disabled={isSubmittingBuy || isSubmittingSell}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-slate-950 font-bold py-3 rounded-lg transition-colors mt-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmittingBuy ? "BROADCASTING..." : "EXECUTE BUY ORDER"}
                </button>
              </div>
            </div>

            {/* Sell Interface */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
              <div className="flex justify-between mb-4">
                <span className="text-sm font-semibold text-rose-400">Sell {BASE_ASSET.code}</span>
                <span className="text-xs text-slate-500 font-mono">Limit</span>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-mono">Price</span>
                  <input 
                    type="number" 
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0.0000" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-mono">Amount</span>
                  <input 
                    type="number" 
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.00" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono pr-1">
                  Total: {sellPrice && sellAmount ? (parseFloat(sellPrice) * parseFloat(sellAmount)).toFixed(4) : "0.0000"} {QUOTE_ASSET.code}
                </div>
                <button 
                  onClick={() => executeOrder("SELL")}
                  disabled={isSubmittingBuy || isSubmittingSell}
                  className="w-full bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/50 text-white font-bold py-3 rounded-lg transition-colors mt-2 shadow-lg shadow-rose-500/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmittingSell ? "BROADCASTING..." : "EXECUTE SELL ORDER"}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex flex-col items-center gap-2">
          {tradeMessage && (
            <div className={`text-xs px-4 py-2 rounded border ${tradeMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
              {tradeMessage.text}
            </div>
          )}
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
            Settlement: Atomic T+0 • Network Fee: 0.00001 XLM
          </p>
        </div>
      </div>
    </div>
  );
}