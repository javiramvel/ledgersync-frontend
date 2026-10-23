"use client";

import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { BASE_FEE, Contract, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk";
import { freighterNetwork, network } from "./network";
import { describeError, server } from "./soroban";

export async function connectFreighter(): Promise<string> {
  const status = await isConnected();
  if (!status.isConnected) throw new Error("Freighter is not installed. Get it at freighter.app.");
  const access = await requestAccess();
  if (access.error) throw new Error(String(access.error));
  await assertNetwork();
  return access.address;
}

/** Returns the already-authorized address without prompting, or null. */
export async function currentAddress(): Promise<string | null> {
  const status = await isConnected();
  if (!status.isConnected) return null;
  const res = await getAddress();
  return res.address || null;
}

async function assertNetwork() {
  const n = await getNetwork();
  if (n.network !== freighterNetwork) {
    throw new Error(`Freighter is on ${n.network}. Switch it to ${network.label} to continue.`);
  }
}

export interface InvokeResult {
  hash: string;
  returnValue?: xdr.ScVal;
}

/**
 * Builds, simulates, signs in Freighter and submits a contract invocation, then waits for the
 * ledger result. The private key never leaves the wallet.
 */
export async function invoke(
  source: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  errorScope?: string,
): Promise<InvokeResult> {
  await assertNetwork();
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: network.passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (e) {
    throw new Error(describeError(String((e as Error).message ?? e), errorScope));
  }

  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase: network.passphrase,
    address: source,
  });
  if (signed.error) throw new Error(`Signature rejected: ${signed.error}`);

  const envelope = TransactionBuilder.fromXDR(signed.signedTxXdr, network.passphrase);
  const sent = await server.sendTransaction(envelope);
  if (sent.status === "ERROR") {
    throw new Error(`Network rejected the transaction: ${sent.errorResult?.result().switch().name ?? "unknown"}`);
  }

  const final = await server.pollTransaction(sent.hash, { attempts: 30, sleepStrategy: () => 1000 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${final.status.toLowerCase()} on-chain (hash ${sent.hash}).`);
  }
  return { hash: sent.hash, returnValue: final.returnValue };
}
