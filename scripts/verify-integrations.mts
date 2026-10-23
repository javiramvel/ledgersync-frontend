/**
 * End-to-end check of the server-side integrations against the real services.
 *
 *   npx tsx --conditions=react-server scripts/verify-integrations.mts <ledgersync-tx-hash> [non-invoke-tx-hash]
 *
 * Archives the given (successful) LedgerSync transaction to the WORM bucket. The record is
 * locked for AUDIT_RETENTION_YEARS and cannot be deleted, so only pass real LedgerSync txs.
 */
import { Products } from "plaid";
import { getRecord, listRecords, recordTransaction } from "../src/lib/audit.ts";
import { merkleRoot } from "../src/lib/merkle.ts";
import { fetchHoldings, plaid } from "../src/lib/plaid.ts";

const [hash, nonInvoke] = process.argv.slice(2);
if (!hash) throw new Error("usage: verify-integrations.mts <tx-hash> [non-invoke-tx-hash]");

if (nonInvoke) {
  try {
    await recordTransaction(nonInvoke);
    console.log("✗ non-invocation transaction was archived");
  } catch (e) {
    console.log("✓ non-invocation transaction rejected:", (e as Error).message);
  }
}
const first = await recordTransaction(hash);
const second = await recordTransaction(hash);
console.log(`✓ archived ${first.key} (created=${first.created}); second call created=${second.created}`);
const rec = await getRecord(hash);
console.log(`✓ record ${rec?.contractRole}.${rec?.function} retainUntil=${rec?.retainUntil} digest=${rec?.digest.slice(0, 16)}…`);
console.log("✓ archive listing:", (await listRecords()).map((r) => `${r.contractRole}.${r.function}`).join(", "));

const api = plaid();
const pt = await api.sandboxPublicTokenCreate({ institution_id: "ins_109508", initial_products: [Products.Investments] });
const ex = await api.itemPublicTokenExchange({ public_token: pt.data.public_token });
const snap = await fetchHoldings(ex.data.access_token);
console.log(`✓ Plaid ${snap.institution}: ${snap.positions.length} positions, e.g. ${snap.positions.slice(0, 3).map((p) => `${p.ticker}=${p.quantity}`).join(", ")}`);
const root = merkleRoot(snap.positions.map((p) => ({ accountId: p.accountId, securityId: p.securityId, units: String(Math.round(p.quantity * 1e7)) })));
console.log(`✓ Merkle root over holdings: ${root}`);
await api.itemRemove({ access_token: ex.data.access_token });
