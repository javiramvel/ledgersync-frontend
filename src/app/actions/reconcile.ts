"use server";

import { getInvestmentHoldings } from "./plaid";

interface ReconciliationDelta {
  ticker: string;
  tradFiQuantity: number;
  onChainBalance: number;
  delta: number; // Positive = Mint required, Negative = Burn required
  action: "MINT" | "BURN" | "SYNCED";
}

export async function calculatePortfolioDelta(accessToken: string, mockOnChainBalances: Record<string, number>): Promise<{ success: boolean; deltas?: ReconciliationDelta[]; error?: string }> {
  try {
    // 1. Fetch live traditional holdings from Plaid
    const plaidData = await getInvestmentHoldings(accessToken);
    if (!plaidData.success || !plaidData.holdings || !plaidData.securities) {
      throw new Error("Failed to retrieve holdings for delta calculation.");
    }

    const { holdings, securities } = plaidData.data || plaidData; // handling structure fallback

    // Map security IDs to ticker symbols
    const securityMap = new Map<string, string>();
    securities.forEach((sec: any) => {
      securityMap.set(sec.security_id, sec.ticker_symbol || sec.name);
    });

    const deltas: ReconciliationDelta[] = [];

    // Aggregate traditional quantities per ticker
    const tradFiTotals = new Map<string, number>();
    holdings.forEach((h: any) => {
      const ticker = securityMap.get(h.security_id) || "UNKNOWN";
      const currentQty = tradFiTotals.get(ticker) || 0;
      tradFiTotals.set(ticker, currentQty + h.quantity);
    });

    // 2. Compare against on-chain balances (passed from Soroban ledger state)
    tradFiTotals.forEach((tradFiQty, ticker) => {
      const onChainQty = mockOnChainBalances[ticker] || 0;
      const delta = tradFiQty - onChainQty;

      let action: "MINT" | "BURN" | "SYNCED" = "SYNCED";
      if (delta > 0) action = "MINT";
      else if (delta < 0) action = "BURN";

      deltas.push({
        ticker,
        tradFiQuantity: tradFiQty,
        onChainBalance: onChainQty,
        delta: Math.abs(delta),
        action,
      });
    });

    return { success: true, deltas };
  } catch (error: any) {
    console.error("Reconciliation Delta Error:", error.message);
    return { success: false, error: "Failed to compute portfolio data delta." };
  }
}
