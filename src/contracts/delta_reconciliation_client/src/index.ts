import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAWO66JUUICXAL5E6DTCGGDL73UNF65V6IRSXQAOPY6VNBF2FRT6Z3YX",
  }
} as const

export const SyncError = {
  1: {message:"InvalidSequence"},
  2: {message:"Unauthorized"},
  3: {message:"ReplayAttackDetected"}
}

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initializes the contract, locking it to a specific off-chain administrator API
   */
  initialize: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a sync_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The core reconciliation function. Requires cryptographic auth and sequential nonces.
   */
  sync_state: ({expected_nonce, new_supply}: {expected_nonce: u64, new_supply: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAE5Jbml0aWFsaXplcyB0aGUgY29udHJhY3QsIGxvY2tpbmcgaXQgdG8gYSBzcGVjaWZpYyBvZmYtY2hhaW4gYWRtaW5pc3RyYXRvciBBUEkAAAAAAAppbml0aWFsaXplAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAFRUaGUgY29yZSByZWNvbmNpbGlhdGlvbiBmdW5jdGlvbi4gUmVxdWlyZXMgY3J5cHRvZ3JhcGhpYyBhdXRoIGFuZCBzZXF1ZW50aWFsIG5vbmNlcy4AAAAKc3luY19zdGF0ZQAAAAAAAgAAAAAAAAAOZXhwZWN0ZWRfbm9uY2UAAAAAAAYAAAAAAAAACm5ld19zdXBwbHkAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAH0AAAAAlTeW5jRXJyb3IAAAA=",
        "AAAABAAAAAAAAAAAAAAACVN5bmNFcnJvcgAAAAAAAAMAAAAAAAAAD0ludmFsaWRTZXF1ZW5jZQAAAAABAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAACAAAAAAAAABRSZXBsYXlBdHRhY2tEZXRlY3RlZAAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<null>,
        sync_state: this.txFromJSON<Result<void>>
  }
}