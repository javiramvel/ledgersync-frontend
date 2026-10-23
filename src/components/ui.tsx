import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { txUrl } from "@/lib/network";

export function Card({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

const VARIANTS = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white",
  success: "bg-green-600 hover:bg-green-500 text-white",
  danger: "bg-red-600 hover:bg-red-500 text-white",
  admin: "bg-purple-600 hover:bg-purple-500 text-white",
  quiet: "bg-slate-200/70 hover:bg-slate-200 text-slate-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white",
} as const;

export function Button({ variant = "primary", busy, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none ${VARIANTS[variant]} ${className}`}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

const fieldClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-black/40";

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input {...props} className={`${fieldClass} ${props.className ?? ""}`} />
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <select {...props} className={fieldClass}>
        {children}
      </select>
    </label>
  );
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-black/30">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  );
}

export type TxState =
  | { kind: "idle" }
  | { kind: "pending"; message: string }
  | { kind: "success"; message: string; hash: string; archived?: string }
  | { kind: "error"; message: string };

export function TxNotice({ state }: { state: TxState }) {
  if (state.kind === "idle") return null;
  const tone =
    state.kind === "success"
      ? "border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300"
      : state.kind === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
        : "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300";
  return (
    <div role="status" aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p>{state.message}</p>
      {state.kind === "success" && (
        <p className="mt-1 flex flex-wrap gap-x-4 font-mono text-xs">
          <a href={txUrl(state.hash)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {state.hash.slice(0, 16)}… on StellarExpert
          </a>
          {state.archived && <span>{state.archived}</span>}
        </p>
      )}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "green" | "amber" | "red" | "blue"; children: ReactNode }) {
  const tones = {
    neutral: "bg-slate-200/70 text-slate-700 dark:bg-white/10 dark:text-slate-300",
    green: "bg-green-500/15 text-green-700 dark:text-green-300",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    red: "bg-red-500/15 text-red-700 dark:text-red-300",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
