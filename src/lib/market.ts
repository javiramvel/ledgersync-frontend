import "server-only";

export interface Quote {
  symbol: string;
  price: number;
  changePct: number;
}

/** Off-chain reference quote from Finnhub (server-side; the API key never reaches the browser). */
export async function finnhubQuote(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return null;
    const q = (await res.json()) as { c?: number; dp?: number };
    if (!q.c) return null;
    return { symbol, price: q.c, changePct: q.dp ?? 0 };
  } catch {
    return null;
  }
}

/** Equity benchmarks shown for TradFi context; Chainlink has no equity feeds on Stellar yet. */
export const EQUITY_BENCHMARKS = ["SPY", "QQQ", "AAPL", "MSFT", "BRK.B"] as const;
