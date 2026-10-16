"use client";

import { useState, useMemo } from "react";
import { useOrderBook } from "@/hooks/useOrderBook";

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#000000] p-1 rounded-3xl">
      
      <div className="lg:col-span-4 bg-[#1C1C1E]/50 border border-[#2C2C2E] rounded-2xl p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b border-[#2C2C2E] pb-2">
          <h3 className="text-sm font-semibold text-white">Order Book (SDEX)</h3>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 ${
            isLoading ? "text-[#8E8E93] bg-[#2C2C2E]/50" : "text-[#34C759] bg-[#34C759]/10"
          }`}>
            {!isLoading && <span className="h-1.5 w-1.5 bg-[#34C759] rounded-full animate-pulse"></span>}
            {isLoading ? "SYNCING..." : "LIVE"}
          </span>
        </div>

        <div className="text-[10px] font-mono text-[#8E8E93] flex justify-between px-2 mb-2 uppercase tracking-wider">
          <span>Price ({QUOTE_ASSET.code})</span>
          <span>Size ({BASE_ASSET.code})</span>
          <span>Total</span>
        </div>

        <div className="space-y-0.5 mb-3 flex-1 flex flex-col justify-end">
          {displayAsks.length === 0 && !isLoading && (
            <div className="text-center text-xs text-[#8E8E93] py-2">No sell orders</div>
          )}
          {displayAsks.map((ask, idx) => {
            const depthPct = ((ask.total || 0) / maxVolume) * 100;
            return (
              <div 
                key={`ask-${idx}`} 
                onClick={() => handleRowClick(ask.price, setBuyPrice)}
                className="relative flex justify-between text-xs font-mono px-2 py-1 group cursor-pointer hover:bg-[#2C2C2E]/50"
              >
                <div className="absolute right-0 top-0 bottom-0 bg-[#FF3B30]/10 z-0 transition-all duration-300" style={{ width: depthPct + "%" }}></div>
                <span className="text-[#FF3B30] z-10">{parseFloat(ask.price).toFixed(4)}</span>
                <span className="text-[#F2F2F7] z-10">{parseFloat(ask.amount).toFixed(2)}</span>
                <span className="text-[#8E8E93] z-10">{ask.total?.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        <div className="py-2 flex items-center justify-between border-y border-[#2C2C2E] mb-3 px-2 bg-[#000000]/30">
          <span className="text-lg font-bold text-white tracking-tight">
            {displayAsks.length && displayBids.length ? `${midPrice}` : "---"}
          </span>
          <span className="text-[10px] font-mono text-[#8E8E93]">
            Spread: {spread}
          </span>
        </div>

        <div className="space-y-0.5 flex-1">
          {displayBids.length === 0 && !isLoading && (
            <div className="text-center text-xs text-[#8E8E93] py-2">No buy orders</div>
          )}
          {displayBids.map((bid, idx) => {
            const depthPct = ((bid.total || 0) / maxVolume) * 100;
            return (
              <div 
                key={`bid-${idx}`} 
                onClick={() => handleRowClick(bid.price, setSellPrice)}
                className="relative flex justify-between text-xs font-mono px-2 py-1 group cursor-pointer hover:bg-[#2C2C2E]/50"
              >
                <div className="absolute right-0 top-0 bottom-0 bg-[#34C759]/10 z-0 transition-all duration-300" style={{ width: depthPct + "%" }}></div>
                <span className="text-[#34C759] z-10">{parseFloat(bid.price).toFixed(4)}</span>
                <span className="text-[#F2F2F7] z-10">{parseFloat(bid.amount).toFixed(2)}</span>
                <span className="text-[#8E8E93] z-10">{bid.total?.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-8 bg-[#1C1C1E]/50 border border-[#2C2C2E] rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start border-b border-[#2C2C2E] pb-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Berkshire Hathaway Inc. Mirror</h2>
              <p className="text-sm text-[#8E8E93] font-mono mt-1">Stellar Contract: {BASE_ASSET.issuer.substring(0,8)}...{BASE_ASSET.issuer.substring(BASE_ASSET.issuer.length - 4)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[#F2F2F7]">Available Balance</p>
              <p className="text-xl font-mono text-[#5E5CE6] mt-0.5">142.50 {QUOTE_ASSET.code}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#000000] border border-[#2C2C2E] rounded-xl p-4">
              <div className="flex justify-between mb-4">
                <span className="text-sm font-semibold text-[#34C759]">Buy {BASE_ASSET.code}</span>
                <span className="text-xs text-[#8E8E93] font-mono">Limit</span>
              </div>
              <div className="space-y-3">
                <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-[#8E8E93] font-mono">Price</span>
                  <input 
                    type="number" 
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="0.0000" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-[#8E8E93] font-mono">Amount</span>
                  <input 
                    type="number" 
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.00" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="text-right text-[10px] text-[#8E8E93] font-mono pr-1">
                  Total: {buyPrice && buyAmount ? (parseFloat(buyPrice) * parseFloat(buyAmount)).toFixed(4) : "0.0000"} {QUOTE_ASSET.code}
                </div>
                <button 
                  onClick={() => executeOrder("BUY")}
                  disabled={isSubmittingBuy || isSubmittingSell}
                  className="w-full bg-[#34C759] hover:bg-[#34C759]/80 disabled:bg-[#34C759]/30 disabled:text-white/50 text-[#000000] font-bold py-3 rounded-lg transition-colors mt-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmittingBuy ? "BROADCASTING..." : "EXECUTE BUY ORDER"}
                </button>
              </div>
            </div>

            <div className="bg-[#000000] border border-[#2C2C2E] rounded-xl p-4">
              <div className="flex justify-between mb-4">
                <span className="text-sm font-semibold text-[#FF3B30]">Sell {BASE_ASSET.code}</span>
                <span className="text-xs text-[#8E8E93] font-mono">Limit</span>
              </div>
              <div className="space-y-3">
                <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-[#8E8E93] font-mono">Price</span>
                  <input 
                    type="number" 
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0.0000" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg p-2.5 flex justify-between items-center">
                  <span className="text-xs text-[#8E8E93] font-mono">Amount</span>
                  <input 
                    type="number" 
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.00" 
                    className="bg-transparent text-right text-sm font-mono text-white outline-none w-1/2" 
                  />
                </div>
                <div className="text-right text-[10px] text-[#8E8E93] font-mono pr-1">
                  Total: {sellPrice && sellAmount ? (parseFloat(sellPrice) * parseFloat(sellAmount)).toFixed(4) : "0.0000"} {QUOTE_ASSET.code}
                </div>
                <button 
                  onClick={() => executeOrder("SELL")}
                  disabled={isSubmittingBuy || isSubmittingSell}
                  className="w-full bg-[#FF3B30] hover:bg-[#FF3B30]/80 disabled:bg-[#FF3B30]/30 disabled:text-white/50 text-[#000000] font-bold py-3 rounded-lg transition-colors mt-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmittingSell ? "BROADCASTING..." : "EXECUTE SELL ORDER"}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex flex-col items-center gap-2">
          {tradeMessage && (
            <div className={`text-xs px-4 py-2 rounded border ${tradeMessage.type === 'success' ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20' : 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20'}`}>
              {tradeMessage.text}
            </div>
          )}
          <p className="text-[10px] text-[#8E8E93] font-mono uppercase tracking-widest">
            Settlement: Atomic T+0 • Network Fee: 0.00001 XLM
          </p>
        </div>
      </div>
    </div>
  );
}