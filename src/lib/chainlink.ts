import { network } from "./network";
import { readContract, sc } from "./soroban";

export type FeedCategory = "Crypto" | "Stablecoin" | "Real-World Asset";

export interface FeedDefinition {
  symbol: string;
  description: string;
  category: FeedCategory;
  /** 32-byte Chainlink data_id; identical on Stellar Testnet and Mainnet. */
  dataId: string;
  /** Finnhub symbol used for the off-chain price-parity check, where one exists. */
  parity?: string;
}

/**
 * Every Chainlink Data Feed live on Stellar (enumerated from the DataFeedsCache `FeedUpdated`
 * events and confirmed via `description(data_id)` on the proxy, October 2026).
 */
export const FEEDS: FeedDefinition[] = [
  { symbol: "XLM/USD", description: "Stellar Lumens", category: "Crypto", dataId: "017be2f55a000332000000000000000000000000000000000000000000000000", parity: "BINANCE:XLMUSDT" },
  { symbol: "BTC/USD", description: "Bitcoin", category: "Crypto", dataId: "01a0b4d920000332000000000000000000000000000000000000000000000000", parity: "BINANCE:BTCUSDT" },
  { symbol: "ETH/USD", description: "Ether", category: "Crypto", dataId: "01d585327c000332000000000000000000000000000000000000000000000000", parity: "COINBASE:ETH-USD" },
  { symbol: "LINK/USD", description: "Chainlink", category: "Crypto", dataId: "0101199b3b000332000000000000000000000000000000000000000000000000", parity: "BINANCE:LINKUSDT" },
  { symbol: "USDC/USD", description: "USD Coin", category: "Stablecoin", dataId: "01a80ff216000332000000000000000000000000000000000000000000000000" },
  { symbol: "USDT/USD", description: "Tether", category: "Stablecoin", dataId: "016d06ebb6000332000000000000000000000000000000000000000000000000" },
  { symbol: "EURC/USD", description: "Euro Coin", category: "Stablecoin", dataId: "01962615c3000332000000000000000000000000000000000000000000000000" },
  { symbol: "FLHY/USD", description: "Franklin High Yield (tokenized fund)", category: "Real-World Asset", dataId: "0142ac24bc000332000000000000000000000000000000000000000000000000" },
  { symbol: "XAUM/USD", description: "Tokenized gold reference rate", category: "Real-World Asset", dataId: "0197aabf9c000332000000000000000000000000000000000000000000000000" },
  { symbol: "USPC NAV", description: "Tokenized fund net asset value", category: "Real-World Asset", dataId: "016e06407e000332000000000000000000000000000000000000000000000000" },
];

export interface FeedReading extends FeedDefinition {
  price: number | null;
  roundId: number | null;
  updatedAt: string | null;
  error?: string;
}

interface Round {
  answer: bigint;
  round_id: bigint;
  timestamp: bigint;
}

const DECIMALS = 18;

export async function readFeed(feed: FeedDefinition): Promise<FeedReading> {
  try {
    const round = await readContract<Round>(network.contracts.chainlinkProxy, "latest_round", [
      sc.bytes32(feed.dataId),
      sc.u32(DECIMALS),
    ]);
    // Keep 8 significant decimals when converting the 18-decimal I256 answer.
    const price = Number(round.answer / 10n ** 10n) / 1e8;
    return {
      ...feed,
      price,
      roundId: Number(round.round_id),
      updatedAt: new Date(Number(round.timestamp) * 1000).toISOString(),
    };
  } catch (e) {
    return { ...feed, price: null, roundId: null, updatedAt: null, error: (e as Error).message };
  }
}

export function readAllFeeds(): Promise<FeedReading[]> {
  return Promise.all(FEEDS.map(readFeed));
}
