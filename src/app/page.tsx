// src/app/page.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
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

const SYMBOL_LABELS: Record<string, string> = {
  SPY: "S&P 500 (SPY)",
  QQQ: "NASDAQ (QQQ)",
  AAPL: "AAPL",
  TSLA: "TSLA",
  "BRK.B": "BRK.B",
};

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1D": "Past 24 Hours",
  "1W": "Past 7 Days",
  "1M": "Past 30 Days",
  "1Y": "Past 52 Weeks",
};

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
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
              Corporate Action Engine 2
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded">
              Algorithmic Multiplier
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight mt-1">
            On-Chain Stock Split Execution
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Atomic re-scaling of all circulating float balances via Soroban contract state.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>Target Asset:</span>
          <strong className="text-emerald-400 font-normal">CCXE...SSPO</strong>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-7 space-y-2">
          <label className="text-xs font-mono uppercase text-slate-400 block">
            Split Ratio Configuration
          </label>
          <div className="relative">
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-mono appearance-none cursor-pointer"
            >
              <option value="2,1">2:1 Forward Split (Double circulating units, halve nominal unit price)</option>
              <option value="3,1">3:1 Forward Split (Triple circulating units)</option>
              <option value="5,1">5:1 Forward Split (5x circulating supply)</option>
              <option value="1,2">1:2 Reverse Split (Consolidate units 2:1)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
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
                ? "bg-indigo-600/50 text-indigo-200 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                Broadcasting to Soroban...
              </>
            ) : (
              "Authorize & Execute Split"
            )}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mt-4 p-4 rounded-xl border text-xs font-mono flex flex-col gap-1 ${
            txHash
              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/30 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{statusMessage}</span>
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white transition-colors"
              >
                View on StellarExpert →
              </a>
            )}
          </div>
          {txHash && (
            <span className="text-[11px] text-slate-400 break-all select-all mt-1">
              Tx: {txHash}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

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
  }, []);

  const macroAsset = marketData["SPY"];

  const { pathLine, pathArea } = useMemo(() => {
    const rawValues = historicalChart.points;
    if (!rawValues || rawValues.length === 0) {
      return { pathLine: "", pathArea: "" };
    }

    const min = historicalChart.minPrice * 0.998;
    const max = historicalChart.maxPrice * 1.002;
    const range = max - min || 1;

    const width = 500;
    const height = 150;
    const padding = 15;

    const coords = rawValues.map((val: number, idx: number) => {
      const x = (idx / (rawValues.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return { x, y };
    });

    let lineD = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cpX = p0.x + (p1.x - p0.x) / 2;
      lineD += ` C ${cpX.toFixed(1)},${p0.y.toFixed(1)} ${cpX.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
    }

    const areaD = `${lineD} L ${width},${height} L 0,${height} Z`;

    return { pathLine: lineD, pathArea: areaD };
  }, [historicalChart.points, historicalChart.minPrice, historicalChart.maxPrice]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased">
      {/* Top Header Marquee: Live Feed Stream */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 py-2.5 overflow-hidden flex items-center relative z-50">
        <div className="absolute left-0 z-20 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent pl-4 pr-8 py-2 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold">
            NYSE • SDEX Live Feed
          </span>
        </div>

        <div className="animate-marquee flex items-center whitespace-nowrap pl-40 gap-8 text-xs font-mono">
          {TRACKED_SYMBOLS.map((sym) => {
            const feed = marketData[sym];
            const label = SYMBOL_LABELS[sym];

            if (!feed || feed.price === undefined) {
              return (
                <span key={sym} className="text-slate-600 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse"></span>
                  {label} <span className="text-[10px] uppercase tracking-wider text-slate-500">[Syncing...]</span>
                </span>
              );
            }

            const changeVal = feed.change ?? 0;
            const isPositive = changeVal >= 0;

            return (
              <span key={sym} className="text-slate-400 transition-all duration-300">
                {label}{" "}
                <strong className={isPositive ? "text-emerald-400 font-normal" : "text-rose-400 font-normal"}>
                  ${feed.price.toFixed(2)} ({isPositive ? `+${changeVal.toFixed(2)}%` : `${changeVal.toFixed(2)}%`})
                </strong>
              </span>
            );
          })}
          <span className="text-slate-400">
            USDC/XLM <strong className="text-slate-200 font-normal">0.1142</strong>
          </span>
          <span className="text-slate-400">
            Total RWA Market Cap <strong className="text-indigo-400 font-normal">$4.82B</strong>
          </span>
        </div>
      </div>

      {/* Global Header */}
      <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
            LS
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              LedgerSync Prime
              <span className="px-1.5 py-0.5 text-[9px] font-mono tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                SEC Rule 17a-4 Compliant
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span>
            {process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? "Stellar Mainnet" : "Horizon Testnet"}: <strong className="text-emerald-400 font-normal">Connected</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            Latency: <strong className="text-slate-200 font-normal">42ms</strong>
          </span>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Upper Hero Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* S&P 500 / Macro Index Display */}
          <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Global Equities Mirror Index
                </p>
                <h3 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-baseline gap-3">
                  S&P 500 Composite
                  {macroAsset && !historicalChart.isLoading ? (
                    <span
                      className={`text-sm font-semibold font-mono ${
                        historicalChart.periodChange >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      ${macroAsset.price?.toFixed(2) || "0.00"}{" "}
                      <span>
                        ({historicalChart.periodChange >= 0 ? `+${historicalChart.periodChange.toFixed(2)}%` : `${historicalChart.periodChange.toFixed(2)}%`})
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded animate-pulse">
                      Syncing Historical Chain...
                    </span>
                  )}
                </h3>
              </div>

              {/* Functional Timeframe Buttons */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                {(["1D", "1W", "1M", "1Y"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      timeframe === tf
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Real-Time Bézier Graph */}
            <div className="w-full h-48 my-2 relative flex items-end">
              {!historicalChart.isLoading && historicalChart.points.length > 0 ? (
                <div className="w-full h-full relative">
                  <div className="absolute top-1 right-2 text-[10px] font-mono text-slate-500">
                    High: ${historicalChart.maxPrice.toFixed(2)}
                  </div>
                  <div className="absolute bottom-1 right-2 text-[10px] font-mono text-slate-500">
                    Low: ${historicalChart.minPrice.toFixed(2)}
                  </div>

                  <svg
                    className="w-full h-full overflow-visible transition-all duration-500"
                    viewBox="0 0 500 150"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={pathArea} fill="url(#chartGradient)" className="transition-all duration-500" />
                    <path
                      d={pathLine}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-2xl bg-slate-950/20">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-ping mb-2"></span>
                  <p className="text-xs font-mono text-slate-500">Loading {timeframe} Candle Data...</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800/60 text-xs font-mono">
              <div>
                <p className="text-slate-500">Time Horizon</p>
                <p className="text-slate-200 font-semibold mt-0.5">{TIMEFRAME_LABELS[timeframe]}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Assets Backed</p>
                <p className="text-slate-200 font-semibold mt-0.5">100.00%</p>
              </div>
              <div>
                <p className="text-slate-500">Custodian Clearance</p>
                <p className="text-emerald-400 font-semibold mt-0.5">Instant T+0</p>
              </div>
            </div>
          </div>

          {/* Access Portals */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6">
              <h2 className="text-lg font-semibold text-white">Select Access Channel</h2>
              <p className="text-xs text-slate-400 mt-1">
                Choose your credentialed operational workspace:
              </p>

              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setActivePortal("trading")}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    activePortal === "trading"
                      ? "bg-indigo-600/10 border-indigo-500 text-white shadow-lg shadow-indigo-500/10"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">1. Live Trading & DEX Terminal</span>
                      <span className="px-1.5 py-0.5 text-[9px] bg-slate-800 text-slate-300 rounded font-mono">
                        T+0 Atomic
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Trade tokenized equities on Stellar DEX order books.
                    </p>
                  </div>
                  <span className="text-slate-500 text-sm">→</span>
                </button>

                <button
                  onClick={() => setActivePortal("executive")}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    activePortal === "executive"
                      ? "bg-indigo-600/10 border-indigo-500 text-white shadow-lg shadow-indigo-500/10"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">2. Corporate Issuance & Treasury</span>
                      <span className="px-1.5 py-0.5 text-[9px] bg-indigo-500/20 text-indigo-300 rounded font-mono">
                        For CEOs
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mint, burn, program dividends & reconcile corporate equity.
                    </p>
                  </div>
                  <span className="text-slate-500 text-sm">→</span>
                </button>

                <button
                  onClick={() => setActivePortal("auditor")}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    activePortal === "auditor"
                      ? "bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">3. Regulatory & Solvency Audit</span>
                      <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-mono">
                        Merkle Proofs
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      24/7 cryptographic reserve verification & compliance export.
                    </p>
                  </div>
                  <span className="text-slate-500 text-sm">→</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl px-5 py-3 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Active Identity:</span>
              <span className="text-slate-200 bg-slate-800 px-2 py-0.5 rounded">did:stellar:GB5...K39</span>
            </div>
          </div>
        </section>

        {/* Dynamic Operational Workspace */}
        <section className="space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              {activePortal === "trading" && "Trading & Secondary Market Terminal"}
              {activePortal === "executive" && "Corporate Governance & Treasury Hub"}
              {activePortal === "auditor" && "Institutional Audit & Solvency Portal"}
            </h2>
            <span className="text-xs font-mono text-slate-500 uppercase">
              Engine: Soroban v21.0 WASM
            </span>
          </div>

          {activePortal === "trading" && (
            <div className="space-y-6">
              <DexTradingTerminal />
              <MarketWatch isAuthenticated={true} />
            </div>
          )}

          {activePortal === "executive" && (
            <div className="space-y-6">
              <CorporateTreasuryHub />
              <StockSplitEngine />
              <LivePitchOracle />
            </div>
          )}

          {activePortal === "auditor" && (
            <div className="space-y-6">
              <AuditorPortal />
            </div>
          )}
        </section>

        {/* Regulatory Clearance Gateway */}
        <section className="mt-12 pt-8 border-t border-slate-800/60">
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