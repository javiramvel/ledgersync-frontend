import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { network } from "./network";

export const server = new rpc.Server(network.rpcUrl);

// Read-only calls are simulated, never submitted, so any well-formed source account works.
const READ_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

const READ_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/** Simulates a contract call and returns its decoded return value. */
export async function readContract<T>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
    fee: "100",
    networkPassphrase: network.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await withTimeout(server.simulateTransaction(tx), READ_TIMEOUT_MS, `${method} timed out`);
  if (rpc.Api.isSimulationError(sim)) throw new Error(describeError(sim.error));
  if (!sim.result) throw new Error(`${method} returned no value`);
  return scValToNative(sim.result.retval) as T;
}

export const sc = {
  address: (a: string) => new Address(a).toScVal(),
  i128: (v: bigint) => nativeToScVal(v, { type: "i128" }),
  u64: (v: bigint) => nativeToScVal(v, { type: "u64" }),
  u32: (v: number) => nativeToScVal(v, { type: "u32" }),
  bytes32: (hex: string) => nativeToScVal(Buffer.from(hex.replace(/^0x/, ""), "hex"), { type: "bytes" }),
  addresses: (list: string[]) => xdr.ScVal.scvVec(list.map((a) => new Address(a).toScVal())),
};

const CONTRACT_ERRORS: Record<string, string> = {
  // delta_reconciliation
  "reconcile:1": "Nonce already used (replay rejected).",
  "reconcile:2": "Nonce out of sequence. Refresh and retry.",
  "reconcile:3": "Custodian balance cannot be negative.",
  // wall_street_asset
  "asset:1": "Amount must be greater than zero.",
  "asset:2": "Invalid split ratio.",
  "asset:3": "Insufficient on-chain balance.",
  "asset:4": "Destination wallet is not a registered, active institution.",
  "asset:5": "Amount is not representable at the current split ratio.",
  // yield_matrix
  "yield:2": "Holder list must cover the entire supply exactly once.",
  "yield:3": "Margin above the 10% cap.",
  "yield:4": "The asset has no supply to distribute against.",
  // solvency_proof
  "solvency:1": "A newer proof is already published.",
  "solvency:2": "No proof has been published yet.",
  // institutional_compliance
  "compliance:5": "Threshold must be between 1 and the number of officers.",
};

/** Maps raw host errors such as `Error(Contract, #4)` to something an operator can act on. */
export function describeError(raw: string, scope?: string): string {
  const code = raw.match(/Error\(Contract, #(\d+)\)/)?.[1];
  if (code && scope && CONTRACT_ERRORS[`${scope}:${code}`]) return CONTRACT_ERRORS[`${scope}:${code}`];
  if (/Error\(Auth, InvalidAction\)/.test(raw)) return "The connected wallet is not authorized for this action.";
  if (code) return `Contract rejected the call (error #${code}).`;
  const firstLine = raw.split("\n")[0];
  return firstLine.length > 240 ? `${firstLine.slice(0, 240)}…` : firstLine;
}
