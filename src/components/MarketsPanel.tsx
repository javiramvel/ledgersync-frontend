import { readAllFeeds } from "@/lib/chainlink";
import { EQUITY_BENCHMARKS, finnhubQuote } from "@/lib/market";
import { contractUrl, network } from "@/lib/network";
import { usd } from "@/lib/format";
import { Badge, Card } from "./ui";

/** Deviation above which on-chain and off-chain prices are flagged. */
const PARITY_TOLERANCE = 0.01;

function priceDigits(p: number | null) {
  return p !== null && p < 10 ? 4 : 2;
}

export async function MarketsPanel() {
  const [feeds, equities] = await Promise.all([
    readAllFeeds(),
    Promise.all(EQUITY_BENCHMARKS.map(finnhubQuote)),
  ]);
  const parity = await Promise.all(feeds.map((f) => (f.parity ? finnhubQuote(f.parity) : Promise.resolve(null))));

  return (
    <div className="space-y-6">
      <Card
        title="Chainlink Data Feeds on Stellar"
        subtitle="Read directly from Chainlink's DataFeedsProxy contract via Soroban RPC; checked against off-chain quotes."
        action={
          <a href={contractUrl(network.contracts.chainlinkProxy)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
            Proxy contract ↗
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="pb-2 font-medium">Feed</th>
                <th className="pb-2 font-medium">Class</th>
                <th className="pb-2 text-right font-medium">Chainlink (on-chain)</th>
                <th className="pb-2 text-right font-medium">Off-chain reference</th>
                <th className="pb-2 text-right font-medium">Parity</th>
                <th className="pb-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {feeds.map((f, i) => {
                const ref = parity[i];
                const dev = f.price && ref ? Math.abs(f.price - ref.price) / ref.price : null;
                return (
                  <tr key={f.dataId}>
                    <td className="py-2.5">
                      <p className="font-medium">{f.symbol}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{f.description}</p>
                    </td>
                    <td className="py-2.5">
                      <Badge tone={f.category === "Real-World Asset" ? "blue" : "neutral"}>{f.category}</Badge>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {f.error ? <span className="text-red-600 dark:text-red-400">unavailable</span> : usd(f.price, priceDigits(f.price))}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {ref ? usd(ref.price, priceDigits(ref.price)) : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      {dev === null ? (
                        <span className="text-xs text-slate-400">n/a</span>
                      ) : (
                        <Badge tone={dev <= PARITY_TOLERANCE ? "green" : "amber"}>{(dev * 100).toFixed(2)}%</Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-xs text-slate-500 dark:text-slate-400">
                      {f.updatedAt ? new Date(f.updatedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="TradFi benchmarks" subtitle="Off-chain equity quotes (Finnhub). Chainlink has not published equity feeds on Stellar yet.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {EQUITY_BENCHMARKS.map((s, i) => {
            const q = equities[i];
            return (
              <div key={s} className="rounded-xl bg-slate-50 p-3 dark:bg-black/30">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{s}</p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums">{q ? usd(q.price) : "—"}</p>
                {q && (
                  <p className={`text-xs tabular-nums ${q.changePct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {q.changePct >= 0 ? "+" : ""}
                    {q.changePct.toFixed(2)}%
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
