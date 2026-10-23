import { ASSET_DECIMALS } from "./network";

const SCALE = 10n ** BigInt(ASSET_DECIMALS);

/** Converts on-chain base units (7 decimals) to a display string. */
export function fromUnits(units: bigint | string | number, maxFraction = 2): string {
  const v = BigInt(units);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const whole = abs / SCALE;
  const frac = Number(abs % SCALE) / Number(SCALE);
  const formatted = (Number(whole) + frac).toLocaleString("en-US", { maximumFractionDigits: maxFraction });
  return negative ? `-${formatted}` : formatted;
}

/** Parses a user-entered decimal string into base units. Throws on invalid input. */
export function toUnits(value: string): bigint {
  const clean = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{0,7})?$/.test(clean)) throw new Error("Enter a positive number with up to 7 decimals.");
  const [whole, frac = ""] = clean.split(".");
  return BigInt(whole) * SCALE + BigInt(frac.padEnd(ASSET_DECIMALS, "0"));
}

export function usd(value: number | null, maxFraction = 2): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Math.min(2, maxFraction),
    maximumFractionDigits: maxFraction,
  });
}

export function shortId(id: string, size = 4): string {
  return id.length > size * 2 + 1 ? `${id.slice(0, size)}…${id.slice(-size)}` : id;
}
