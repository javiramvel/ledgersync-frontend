import FreighterConnect from "@/components/wallet/FreighterConnect";
import AtomicSwapAction from "@/components/retail/AtomicSwapAction";

export default function RetailApp() {
  return (
    <main className="min-h-screen flex flex-col items-center pt-10 px-4 sm:px-6 transition-colors duration-300">
      <div className="max-w-md w-full space-y-6">
        
        {/* Mobile Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Ledger-Sync
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Regulated Decentralized Trading
          </p>
        </div>
        
        {/* Retail Glass Container */}
        <div className="bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl shadow-xl dark:shadow-2xl rounded-3xl p-6 border border-slate-200/50 dark:border-white/10 transition-all duration-300">
          
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-white/10">
            <h2 className="text-xl font-bold">Your Wallet</h2>
            <span className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-500/20 rounded-full border border-green-500/30">
              KYC VERIFIED
            </span>
          </div>
          
          <FreighterConnect />
          
          {/* We will build this Atomic Swap component next */}
          <AtomicSwapAction />
          
        </div>
      </div>
    </main>
  );
}
