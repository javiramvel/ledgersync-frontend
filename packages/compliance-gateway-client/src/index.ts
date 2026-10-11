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
    contractId: "CDPBMJTJ53TF3PYC6ASZ6SBV52AFD76UPY2JMFW6U7MPV43EINSNIQYV",
  }
} as const

export enum AssetClass {
  PaymentStablecoin = 0,
  SecInvestmentContract = 1,
  CftcDigitalCommodity = 2,
}

export const ComplianceError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"EntityFrozenOrRevoked"},
  3: {message:"InsufficientSignatures"},
  4: {message:"InvalidTrustAnchor"},
  5: {message:"ProhibitedYieldOnStablecoin"}
}


export interface InstitutionalProfile {
  authorized_officers: Array<string>;
  is_active: boolean;
  lei_hash: Buffer;
  threshold: u32;
  trust_anchor: string;
}

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, oracle}: {admin: string, oracle: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a verify_execution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_execution: ({institution_wallet, signing_officers, asset_class, is_yield_action}: {institution_wallet: string, signing_officers: Array<string>, asset_class: AssetClass, is_yield_action: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a register_institution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_institution: ({trust_anchor, institution_wallet, lei_hash, threshold, authorized_officers}: {trust_anchor: string, institution_wallet: string, lei_hash: Buffer, threshold: u32, authorized_officers: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_compliance_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_compliance_status: ({institution_wallet, is_active}: {institution_wallet: string, is_active: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZvcmFjbGUAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA9Db21wbGlhbmNlRXJyb3IA",
        "AAAAAwAAAAAAAAAAAAAACkFzc2V0Q2xhc3MAAAAAAAMAAAAAAAAAEVBheW1lbnRTdGFibGVjb2luAAAAAAAAAAAAAAAAAAAVU2VjSW52ZXN0bWVudENvbnRyYWN0AAAAAAAAAQAAAAAAAAAUQ2Z0Y0RpZ2l0YWxDb21tb2RpdHkAAAAC",
        "AAAAAAAAAAAAAAAQdmVyaWZ5X2V4ZWN1dGlvbgAAAAQAAAAAAAAAEmluc3RpdHV0aW9uX3dhbGxldAAAAAAAEwAAAAAAAAAQc2lnbmluZ19vZmZpY2VycwAAA+oAAAATAAAAAAAAAAthc3NldF9jbGFzcwAAAAfQAAAACkFzc2V0Q2xhc3MAAAAAAAAAAAAPaXNfeWllbGRfYWN0aW9uAAAAAAEAAAABAAAD6QAAAAEAAAfQAAAAD0NvbXBsaWFuY2VFcnJvcgA=",
        "AAAABAAAAAAAAAAAAAAAD0NvbXBsaWFuY2VFcnJvcgAAAAAFAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAFUVudGl0eUZyb3plbk9yUmV2b2tlZAAAAAAAAAIAAAAAAAAAFkluc3VmZmljaWVudFNpZ25hdHVyZXMAAAAAAAMAAAAAAAAAEkludmFsaWRUcnVzdEFuY2hvcgAAAAAABAAAAAAAAAAbUHJvaGliaXRlZFlpZWxkT25TdGFibGVjb2luAAAAAAU=",
        "AAAAAAAAAAAAAAAUcmVnaXN0ZXJfaW5zdGl0dXRpb24AAAAFAAAAAAAAAAx0cnVzdF9hbmNob3IAAAATAAAAAAAAABJpbnN0aXR1dGlvbl93YWxsZXQAAAAAABMAAAAAAAAACGxlaV9oYXNoAAAD7gAAACAAAAAAAAAACXRocmVzaG9sZAAAAAAAAAQAAAAAAAAAE2F1dGhvcml6ZWRfb2ZmaWNlcnMAAAAD6gAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA9Db21wbGlhbmNlRXJyb3IA",
        "AAAAAQAAAAAAAAAAAAAAFEluc3RpdHV0aW9uYWxQcm9maWxlAAAABQAAAAAAAAATYXV0aG9yaXplZF9vZmZpY2VycwAAAAPqAAAAEwAAAAAAAAAJaXNfYWN0aXZlAAAAAAAAAQAAAAAAAAAIbGVpX2hhc2gAAAPuAAAAIAAAAAAAAAAJdGhyZXNob2xkAAAAAAAABAAAAAAAAAAMdHJ1c3RfYW5jaG9yAAAAEw==",
        "AAAAAAAAAAAAAAAYdXBkYXRlX2NvbXBsaWFuY2Vfc3RhdHVzAAAAAgAAAAAAAAASaW5zdGl0dXRpb25fd2FsbGV0AAAAAAATAAAAAAAAAAlpc19hY3RpdmUAAAAAAAABAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAPQ29tcGxpYW5jZUVycm9yAA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        verify_execution: this.txFromJSON<Result<boolean>>,
        register_institution: this.txFromJSON<Result<void>>,
        update_compliance_status: this.txFromJSON<Result<void>>
  }
}