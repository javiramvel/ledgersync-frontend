"use server";

import { CountryCode, Products } from "plaid";
import { z } from "zod";
import { merkleRoot } from "@/lib/merkle";
import { toUnits } from "@/lib/format";
import {
  clearAccessToken,
  fetchHoldings,
  plaid,
  readAccessToken,
  storeAccessToken,
  type CustodianSnapshot,
} from "@/lib/plaid";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  const plaidError = (e as { response?: { data?: { error_message?: string } } })?.response?.data?.error_message;
  return { ok: false, error: plaidError || (e as Error)?.message || fallback };
}

export async function createLinkToken(walletAddress: string): Promise<Result<string>> {
  try {
    const { data } = await plaid().linkTokenCreate({
      user: { client_user_id: walletAddress },
      client_name: "LedgerSync",
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return { ok: true, data: data.link_token };
  } catch (e) {
    return fail(e, "Could not start the custodian connection.");
  }
}

export async function connectCustodian(publicToken: string): Promise<Result<CustodianSnapshot>> {
  try {
    z.string().min(1).parse(publicToken);
    const { data } = await plaid().itemPublicTokenExchange({ public_token: publicToken });
    await storeAccessToken(data.access_token);
    return { ok: true, data: await fetchHoldings(data.access_token) };
  } catch (e) {
    return fail(e, "Could not connect the custodian account.");
  }
}

export async function getCustodianSnapshot(): Promise<Result<CustodianSnapshot | null>> {
  try {
    const token = await readAccessToken();
    return { ok: true, data: token ? await fetchHoldings(token) : null };
  } catch (e) {
    return fail(e, "Could not read custodian holdings.");
  }
}

export async function disconnectCustodian(): Promise<void> {
  const token = await readAccessToken();
  if (token) await plaid().itemRemove({ access_token: token }).catch(() => undefined);
  await clearAccessToken();
}

export interface ReserveAttestation {
  merkleRoot: string;
  /** Attested reserves of the selected position, in 7-decimal base units. */
  reserveUnits: string;
  leaves: number;
  institution: string;
  fetchedAt: string;
}

/**
 * Re-reads holdings from the custodian (never from the client) and commits every position to a
 * Merkle root. The selected position's quantity becomes the attested reserve for the token.
 */
export async function attestReserves(positionId: string): Promise<Result<ReserveAttestation>> {
  try {
    const token = await readAccessToken();
    if (!token) return { ok: false, error: "Connect a custodian account first." };
    const snap = await fetchHoldings(token);
    const position = snap.positions.find((p) => p.id === positionId);
    if (!position) return { ok: false, error: "Selected position no longer exists at the custodian." };

    const leaves = snap.positions.map((p) => ({
      accountId: p.accountId,
      securityId: p.securityId,
      units: toUnits(p.quantity.toFixed(7)).toString(),
    }));
    return {
      ok: true,
      data: {
        merkleRoot: merkleRoot(leaves),
        reserveUnits: toUnits(position.quantity.toFixed(7)).toString(),
        leaves: leaves.length,
        institution: snap.institution,
        fetchedAt: snap.fetchedAt,
      },
    };
  } catch (e) {
    return fail(e, "Could not attest reserves.");
  }
}
