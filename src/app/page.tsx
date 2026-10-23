import { Dashboard } from "@/components/Dashboard";
import { Header } from "@/components/Header";
import { MarketsPanel } from "@/components/MarketsPanel";

export const revalidate = 60;

export default function Home() {
  return (
    <>
      <Header />
      <Dashboard markets={<MarketsPanel />} />
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-slate-500 dark:text-slate-400">
        LedgerSync · Soroban contracts are open source · Prices from Chainlink Data Feeds on Stellar
      </footer>
    </>
  );
}
