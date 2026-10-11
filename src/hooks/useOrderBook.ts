import { useState, useEffect } from "react";
import { Horizon, StrKey, Asset } from "@stellar/stellar-sdk";

// Connect directly to the Stellar Testnet Horizon server
const server = new Horizon.Server("https://horizon-testnet.stellar.org");

export type OrderbookEntry = {
  price: string;
  amount: string;
  total?: number;
};

// Helper to safely validate Stellar public keys (issuers)
function isValidStellarKey(key: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(key);
  } catch {
    return false;
  }
}

export function useOrderBook(
  sellingCode: string,
  sellingIssuer: string,
  buyingCode: string,
  buyingIssuer: string
) {
  const [bids, setBids] = useState<OrderbookEntry[]>([]);
  const [asks, setAsks] = useState<OrderbookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchBook() {
      try {
        // Sanitize codes and validate issuer keys to prevent Stellar SDK crashes
        const safeSellingCode = sellingCode.replace(/[^a-zA-Z0-9]/g, "");
        const sellingAsset =
          sellingCode === "XLM" || !isValidStellarKey(sellingIssuer)
            ? Asset.native()
            : new Asset(safeSellingCode, sellingIssuer);

        const safeBuyingCode = buyingCode.replace(/[^a-zA-Z0-9]/g, "");
        const buyingAsset =
          buyingCode === "XLM" || !isValidStellarKey(buyingIssuer)
            ? Asset.native()
            : new Asset(safeBuyingCode, buyingIssuer);

        // Fetch top bids and asks from the SDEX
        const orderbook = await server.orderbook(sellingAsset, buyingAsset).call();

        if (!isMounted) return;

        // Map and calculate running totals for the market depth UI
        let bidTotal = 0;
        const formattedBids = orderbook.bids.slice(0, 12).map((b) => {
          bidTotal += parseFloat(b.amount);
          return { price: b.price, amount: b.amount, total: bidTotal };
        });

        let askTotal = 0;
        const formattedAsks = orderbook.asks.slice(0, 12).map((a) => {
          askTotal += parseFloat(a.amount);
          return { price: a.price, amount: a.amount, total: askTotal };
        });

        setBids(formattedBids);
        setAsks(formattedAsks);
        setIsLoading(false);
      } catch (error) {
        // Suppress noisy console output for testnet order books that haven't been initialized yet
        setIsLoading(false);
      }
    }

    fetchBook();
    const interval = setInterval(fetchBook, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sellingCode, sellingIssuer, buyingCode, buyingIssuer]);

  return { bids, asks, isLoading };
}