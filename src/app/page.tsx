// src/app/page.tsx

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { MarketProvider, useMarketData } from "@/lib/MarketDataContext";
import CorporateTreasuryHub from "@/components/dashboard/CorporateTreasuryHub";
import DexTradingTerminal from "@/components/dashboard/DexTradingTerminal";
import MarketWatch from "@/components/dashboard/MarketWatch";
import LivePitchOracle from "@/components/dashboard/LivePitchOracle";
import AuditorPortal from "@/components/dashboard/AuditorPortal";
import ComplianceVerification from "@/components/dashboard/ComplianceVerification";
import { useHistoricalData, Timeframe } from "@/hooks/useHistoricalData";

type PortalMode = "trading" | "executive" | "auditor";

const TRACKED_SYMBOLS = ["SPY", "QQQ", "AAPL", "TSLA", "BRK.B"] as const;

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
  "1Y": "1Y",
};

// ============================================================================
// APPLE STOCKS AESTHETIC: INTERACTIVE CHART
// ============================================================================
function InteractiveChart({ data, min, max, isPositive }: { data: number[], min: number, max: number, isPositive: boolean }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const { pathLine, coords } = useMemo(() => {
    if (!data || data.length === 0) return { pathLine: "", coords: [] };
    const padding = 20;
    const width = 600;
    const height = 200;
    const range = max - min || 1;

    const mappedCoords = data.map((val, idx) => ({
      x: (idx / (data.length - 1)) * width,
      y: height - padding - ((val - min) / range) * (height - padding * 2),
      val
    }));

    let lineD = `M ${mappedCoords[0].x.toFixed(1)},${mappedCoords[0].y.toFixed(1)}`;
    for (let i = 0; i < mappedCoords.length - 1; i++) {
      const p0 = mappedCoords[i];
      const p1 = mappedCoords[i + 1];
      const cpX = p0.x + (p1.x - p0.x) / 2;
      lineD += ` C ${cpX.toFixed(1)},${p0.y.toFixed(1)} ${cpX.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
    }
    return { pathLine: lineD, coords: mappedCoords };
  }, [data, min, max]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const pct = Math.max(0, Math.min(1, x / width));
    const idx = Math.round(pct * (coords.length - 1));
    setHoverIdx(idx);
  };

  const color = isPositive ? "#34C759" : "#FF3B30"; 

  return (
    <div className="relative w-full h-56" onMouseLeave={() => setHoverIdx(null)}>
      {hoverIdx !== null && coords[hoverIdx] && (
        <div 
          className="absolute top-0 pointer-events-none transform -translate-x-1/2 flex flex-col items-center"
          style={{ left: `${(hoverIdx / (coords.length - 1)) * 100}%` }}
        >
          <div className="bg-[#1C1C1E] text-white text-xs font-mono py-1 px-2 rounded border border-[#2C2C2E] shadow-xl z-20">
            ${coords[hoverIdx].val.toFixed(2)}
          </div>
          <div className="w-px h-56 bg-[#2C2C2E] mt-1" />
          <div className="w-2 h-2 rounded-full absolute top-[50%] transform -translate-y-1/2 bg-white border-2" style={{ borderColor: color }} />
        </div>
      )}
      <svg ref={svgRef} onMouseMove={handleMouseMove} className="w-full h-full overflow-visible cursor-crosshair" viewBox="0 0 600 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={`${pathLine} L 600,200 L 0,200 Z`} fill="url(#chartGradient)" className="transition-all duration-300" />
        <path d={pathLine} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-300" />
      </svg>
    </div>
  );
}

// ============================================================================
// PRESERVED COMPONENT: STOCK SPLIT ENGINE
// ============================================================================
function StockSplitEngine() {
  const [ratio, setRatio] = useState<string>("2,1");
  const [loading, setLoading] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const executeSplit = async () => {
    setLoading(true);
    setStatusMessage(null);
    setTxHash(null);

    const [num, den] = ratio.split(",");

    try {
      const res = await fetch("/api/treasury/execute-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numerator: Number(num), denominator: Number(den) }),
      });

      const data = await res.json();
      if (data.success) {
        setTxHash(data.txHash);
        setStatusMessage(`Executed ${num}:${den} Corporate Split • SEC Rule 17a-4 Logged`);
      } else {
        setStatusMessage(`Execution Failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("Network error executing split request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1C1C1E]/50 backdrop-blur-xl border border-[#2C2C2E] rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-[#3A3A3C]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C2C2E] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#8E8E93] font-semibold">
              Corporate Action Engine 2
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-[#1C1C1E] text-[#8E8E93] border border-[#2C2C2E] rounded">
              Algorithmic Multiplier
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight mt-1">
            On-Chain Stock Split Execution
          </h3>
          <p className="text-xs text-[#8E8E93] mt-0.5">
            Atomic re-scaling of all circulating float balances via Soroban contract state.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#8E8E93] bg-[#000000] px-3 py-1.5 rounded-xl border border-[#2C2C2E]">
          <span>Target Asset:</span>
          <strong className="text-[#34C759] font-normal">CCXE...SSPO</strong>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-7 space-y-2">
          <label className="text-xs font-mono uppercase text-[#8E8E93] block">
            Split Ratio Configuration
          </label>
          <div className="relative">
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              disabled={loading}
              className="w-full bg-[#000000] border border-[#2C2C2E] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white transition-all font-mono appearance-none cursor-pointer"
            >
              <option value="2,1">2:1 Forward Split (Double circulating units, halve nominal unit price)</option>
              <option value="3,1">3:1 Forward Split (Triple circulating units)</option>
              <option value="5,1">5:1 Forward Split (5x circulating supply)</option>
              <option value="1,2">1:2 Reverse Split (Consolidate units 2:1)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#8E8E93]">
              ▼
            </div>
          </div>
        </div>

        <div className="md:col-span-5">
          <button
            onClick={executeSplit}
            disabled={loading}
            className={`w-full py-3 px-5 rounded-xl font-mono text-xs uppercase tracking-wider font-semibold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              loading
                ? "bg-white/50 text-black/50 cursor-not-allowed"
                : "bg-white hover:bg-neutral-200 text-black transition-colors"
            }`}
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin"></span>
                Broadcasting...
              </>
            ) : (
              "Authorize & Execute Split"
            )}
          </button>
        </div>
      </div>
      {/* ... keeping your existing status message rendering below ... */}
      {statusMessage && (
        <div className={`mt-4 p-4 rounded-xl border text-xs font-mono flex flex-col gap-1 ${txHash ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#34C759]" : "bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]"}`}>
          <div className="flex items-center justify-between">
            <span>{statusMessage}</span>
            {txHash && <a href={`https://stellar.expert/explorer/public/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline hover:text-white transition-colors">View on StellarExpert →</a>}
          </div>
          {txHash && <span className="text-[11px] text-[#8E8E93] break-all select-all mt-1">Tx: {txHash}</span>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD LAYOUT
// ============================================================================
function DashboardContent() {
  const [activePortal, setActivePortal] = useState<PortalMode>("executive");
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const { marketData, fetchPrice } = useMarketData();
  const historicalChart = useHistoricalData("SPY", timeframe);

  useEffect(() => {
    async function syncMarketStreams() {
      await fetchPrice("AAPL");
      await fetchPrice("SPY");
      for (const symbol of ["QQQ", "TSLA", "BRK.B"]) {
        await fetchPrice(symbol);
      }
    }
    syncMarketStreams();
    const interval = setInterval(syncMarketStreams, 15000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  const macroAsset = marketData["SPY"];
  const isPositive = historicalChart.periodChange >= 0;

  return (
    <div className="min-h-screen bg-[#000000] text-[#F2F2F7] selection:bg-[#34C759]/20 font-sans antialiased relative overflow-hidden">
      
      {/* Live Ticker Marquee */}
      <div className="w-full bg-[#000000] border-b border-[#2C2C2E] py-2 overflow-hidden flex items-center relative z-50">
        <div className="animate-marquee flex items-center whitespace-nowrap gap-8 text-[11px] font-mono tracking-wide px-4">
          {TRACKED_SYMBOLS.map((sym) => {
            const feed = marketData[sym];
            if (!feed || feed.price === undefined) return <span key={sym} className="text-[#8E8E93]">{sym} Syncing...</span>;
            const isPos = (feed.change ?? 0) >= 0;
            return (
              <span key={sym} className="text-[#F2F2F7] transition-colors duration-300">
                {sym} <span className={isPos ? "text-[#34C759]" : "text-[#FF3B30]"}>${feed.price.toFixed(2)}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Global Header */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-[#2C2C2E] relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center font-bold text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]">LS</div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-3">
            LedgerSync
            <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase bg-[#1C1C1E] text-[#8E8E93] border border-[#2C2C2E] rounded-full">
              Institutional
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-[#8E8E93]">
          <span>
            {process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? "Stellar Mainnet" : "Mainnet"}: <strong className="text-[#34C759] font-normal">Connected</strong>
          </span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10 relative z-10">
        {/* Apple Stocks Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-[#1C1C1E]/50 backdrop-blur-xl border border-[#2C2C2E] rounded-3xl p-8 flex flex-col justify-between shadow-2xl transition-all duration-300 hover:border-[#3A3A3C]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-4xl font-semibold text-white tracking-tight flex items-baseline gap-3">
                  {macroAsset && !historicalChart.isLoading ? (
                    <>
                      ${macroAsset.price?.toFixed(2) || "0.00"}
                      <span className={`text-xl font-medium ${isPositive ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                        {isPositive ? "+" : ""}{historicalChart.periodChange.toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-[#8E8E93] animate-pulse">Syncing...</span>
                  )}
                </h3>
                <p className="text-sm font-medium text-[#8E8E93] mt-1">S&P 500 Composite</p>
              </div>

              {/* Seamless Timeframe Toggle */}
              <div className="flex bg-[#000000] p-1 rounded-xl border border-[#2C2C2E]">
                {(["1D", "1W", "1M", "1Y"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      timeframe === tf ? "bg-white text-black shadow-md" : "text-[#8E8E93] hover:text-white"
                    }`}
                  >
                    {TIMEFRAME_LABELS[tf]}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full my-6">
              {!historicalChart.isLoading && historicalChart.points.length > 0 ? (
                <InteractiveChart data={historicalChart.points} min={historicalChart.minPrice} max={historicalChart.maxPrice} isPositive={isPositive} />
              ) : (
                <div className="h-56 w-full flex items-center justify-center border border-dashed border-[#2C2C2E] rounded-2xl">
                  <p className="text-sm text-[#8E8E93]">Loading Chart Data...</p>
                </div>
              )}
            </div>
          </div>

          {/* Institutional Navigation */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <h2 className="text-xs font-mono text-[#8E8E93] uppercase tracking-widest pl-2 mb-2">Modules</h2>
            
            <button onClick={() => setActivePortal("trading")} className={`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${activePortal === "trading" ? "bg-white text-black border-white shadow-lg" : "bg-[#1C1C1E] border-[#2C2C2E] text-white hover:border-[#3A3A3C]"}`}>
              <div className="text-lg font-semibold mb-1">Trading Terminal</div>
              <p className={`text-xs ${activePortal === "trading" ? "text-gray-600" : "text-[#8E8E93]"}`}>Atomic secondary market execution</p>
            </button>

            <button onClick={() => setActivePortal("executive")} className={`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${activePortal === "executive" ? "bg-white text-black border-white shadow-lg" : "bg-[#1C1C1E] border-[#2C2C2E] text-white hover:border-[#3A3A3C]"}`}>
              <div className="text-lg font-semibold mb-1">Corporate Treasury</div>
              <p className={`text-xs ${activePortal === "executive" ? "text-gray-600" : "text-[#8E8E93]"}`}>Asset issuance & compliance control</p>
            </button>

            <button onClick={() => setActivePortal("auditor")} className={`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${activePortal === "auditor" ? "bg-white text-black border-white shadow-lg" : "bg-[#1C1C1E] border-[#2C2C2E] text-white hover:border-[#3A3A3C]"}`}>
              <div className="text-lg font-semibold mb-1">Solvency Audit</div>
              <p className={`text-xs ${activePortal === "auditor" ? "text-gray-600" : "text-[#8E8E93]"}`}>SEC 17a-4 reserve verification</p>
            </button>
          </div>
        </section>

        {/* Dynamic Workspace Rendering */}
        <section className="bg-transparent">
          {activePortal === "trading" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <DexTradingTerminal />
              <MarketWatch isAuthenticated={true} />
            </div>
          )}
          {activePortal === "executive" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CorporateTreasuryHub onSuccessAction={() => {}} />
              <StockSplitEngine />
              <LivePitchOracle />
            </div>
          )}
          {activePortal === "auditor" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AuditorPortal />
            </div>
          )}
        </section>

        <section className="border-t border-[#2C2C2E] pt-8">
          <ComplianceVerification />
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <MarketProvider>
      <DashboardContent />
    </MarketProvider>
  );
}