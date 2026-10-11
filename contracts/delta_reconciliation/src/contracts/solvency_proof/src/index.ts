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
    contractId: "CDYIBWL6QJXXDCI6KO7LLKGROAWW7IIIVAE4X3FC6HTCFLVKHZ4WP653",
  }
} as const

export const SolvencyError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"UnauthorizedOracle"},
  3: {message:"StaleTimestamp"}
}

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Locks the contract to a specific off-chain Oracle API
   */
  initialize: ({oracle}: {oracle: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a publish_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Ingests the 32-byte Merkle Root from the off-chain oracle.
   * Rejects outdated proofs to ensure continuous, real-time solvency tracking.
   */
  publish_root: ({merkle_root, timestamp}: {merkle_root: Buffer, timestamp: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_latest_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allows external auditors or the SEC to query the latest verified root
   */
  get_latest_root: (options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

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
      new ContractSpec([ "AAAAAAAAADVMb2NrcyB0aGUgY29udHJhY3QgdG8gYSBzcGVjaWZpYyBvZmYtY2hhaW4gT3JhY2xlIEFQSQAAAAAAAAppbml0aWFsaXplAAAAAAABAAAAAAAAAAZvcmFjbGUAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Tb2x2ZW5jeUVycm9yAAAA",
        "AAAAAAAAAIVJbmdlc3RzIHRoZSAzMi1ieXRlIE1lcmtsZSBSb290IGZyb20gdGhlIG9mZi1jaGFpbiBvcmFjbGUuClJlamVjdHMgb3V0ZGF0ZWQgcHJvb2ZzIHRvIGVuc3VyZSBjb250aW51b3VzLCByZWFsLXRpbWUgc29sdmVuY3kgdHJhY2tpbmcuAAAAAAAADHB1Ymxpc2hfcm9vdAAAAAIAAAAAAAAAC21lcmtsZV9yb290AAAAA+4AAAAgAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAANU29sdmVuY3lFcnJvcgAAAA==",
        "AAAAAAAAAEVBbGxvd3MgZXh0ZXJuYWwgYXVkaXRvcnMgb3IgdGhlIFNFQyB0byBxdWVyeSB0aGUgbGF0ZXN0IHZlcmlmaWVkIHJvb3QAAAAAAAAPZ2V0X2xhdGVzdF9yb290AAAAAAAAAAABAAAD7gAAACA=",
        "AAAABAAAAAAAAAAAAAAADVNvbHZlbmN5RXJyb3IAAAAAAAADAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAElVuYXV0aG9yaXplZE9yYWNsZQAAAAAAAgAAAAAAAAAOU3RhbGVUaW1lc3RhbXAAAAAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        publish_root: this.txFromJSON<Result<void>>,
        get_latest_root: this.txFromJSON<Buffer>
  }
}