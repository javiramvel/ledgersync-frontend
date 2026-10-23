import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments } from "plaid";

const COOKIE = "ls_custodian";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured.`);
  return v;
}

let client: PlaidApi | null = null;
export function plaid(): PlaidApi {
  if (!client) {
    const env = process.env.PLAID_ENV || "sandbox";
    client = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[env],
        baseOptions: {
          headers: { "PLAID-CLIENT-ID": required("PLAID_CLIENT_ID"), "PLAID-SECRET": required("PLAID_SECRET") },
        },
      }),
    );
  }
  return client;
}

function key(): Buffer {
  return createHash("sha256").update(required("PLAID_TOKEN_SECRET")).digest();
}

export function seal(accessToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

function unseal(sealed: string): string {
  const raw = Buffer.from(sealed, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export async function storeAccessToken(accessToken: string) {
  (await cookies()).set(COOKIE, seal(accessToken), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function readAccessToken(): Promise<string | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return null;
  try {
    return unseal(v);
  } catch {
    return null;
  }
}

export async function clearAccessToken() {
  (await cookies()).delete(COOKIE);
}

export interface CustodialPosition {
  id: string;
  accountId: string;
  accountName: string;
  securityId: string;
  ticker: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
}

export interface CustodianSnapshot {
  institution: string;
  positions: CustodialPosition[];
  fetchedAt: string;
}

export async function fetchHoldings(accessToken: string): Promise<CustodianSnapshot> {
  const api = plaid();
  const { data } = await api.investmentsHoldingsGet({ access_token: accessToken });
  const securities = new Map(data.securities.map((s) => [s.security_id, s]));
  const accounts = new Map(data.accounts.map((a) => [a.account_id, a]));

  let institution = "Connected custodian";
  if (data.item.institution_id) {
    try {
      const inst = await api.institutionsGetById({ institution_id: data.item.institution_id, country_codes: [CountryCode.Us] });
      institution = inst.data.institution.name;
    } catch {
      // Name lookup is cosmetic; holdings are still valid without it.
    }
  }

  const positions = data.holdings.map((h) => {
    const sec = securities.get(h.security_id);
    const acct = accounts.get(h.account_id);
    return {
      id: `${h.account_id}:${h.security_id}`,
      accountId: h.account_id,
      accountName: acct?.name ?? "Account",
      securityId: h.security_id,
      ticker: sec?.ticker_symbol ?? sec?.name ?? "UNKNOWN",
      name: sec?.name ?? "Unknown security",
      quantity: h.quantity,
      price: h.institution_price,
      value: h.institution_value,
    };
  });
  return { institution, positions, fetchedAt: new Date().toISOString() };
}
