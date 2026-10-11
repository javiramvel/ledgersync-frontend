// src/lib/MarketDataContext.tsx

"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface MarketData {
  price?: number;
  change?: number;
  isSyncing?: boolean;
}

interface MarketContextType {
  marketData: Record<string, MarketData>;
  fetchPrice: (ticker: string) => Promise<void>;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});

  // Memoize the function reference to prevent React from seeing a "new" function 
  // on every render, which triggers infinite loops in dependent useEffect hooks.
  const fetchPrice = useCallback(async (ticker: string) => {
    setMarketData((prev) => ({
      ...prev,
      [ticker]: { ...prev[ticker], isSyncing: true },
    }));

    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.NEXT_PUBLIC_FINNHUB_API_KEY}`
      );
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      setMarketData((prev) => ({
        ...prev,
        [ticker]: {
          price: data.c,
          change: data.dp,
          isSyncing: false,
        },
      }));
    } catch (error) {
      console.error(`Failed to fetch price for ${ticker}:`, error);
      // Ensure UI recovers from a loading state if the network request fails
      setMarketData((prev) => ({
        ...prev,
        [ticker]: { ...prev[ticker], isSyncing: false },
      }));
    }
  }, []); // Empty dependency array ensures the memory reference is perfectly stable

  return (
    <MarketContext.Provider value={{ marketData, fetchPrice }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarketData() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error("useMarketData must be used within a MarketProvider");
  }
  return context;
}