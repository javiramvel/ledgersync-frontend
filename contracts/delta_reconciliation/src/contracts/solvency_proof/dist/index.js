import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
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
};
export const SolvencyError = {
    1: { message: "AlreadyInitialized" },
    2: { message: "UnauthorizedOracle" },
    3: { message: "StaleTimestamp" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy(null, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAADVMb2NrcyB0aGUgY29udHJhY3QgdG8gYSBzcGVjaWZpYyBvZmYtY2hhaW4gT3JhY2xlIEFQSQAAAAAAAAppbml0aWFsaXplAAAAAAABAAAAAAAAAAZvcmFjbGUAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Tb2x2ZW5jeUVycm9yAAAA",
            "AAAAAAAAAIVJbmdlc3RzIHRoZSAzMi1ieXRlIE1lcmtsZSBSb290IGZyb20gdGhlIG9mZi1jaGFpbiBvcmFjbGUuClJlamVjdHMgb3V0ZGF0ZWQgcHJvb2ZzIHRvIGVuc3VyZSBjb250aW51b3VzLCByZWFsLXRpbWUgc29sdmVuY3kgdHJhY2tpbmcuAAAAAAAADHB1Ymxpc2hfcm9vdAAAAAIAAAAAAAAAC21lcmtsZV9yb290AAAAA+4AAAAgAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAANU29sdmVuY3lFcnJvcgAAAA==",
            "AAAAAAAAAEVBbGxvd3MgZXh0ZXJuYWwgYXVkaXRvcnMgb3IgdGhlIFNFQyB0byBxdWVyeSB0aGUgbGF0ZXN0IHZlcmlmaWVkIHJvb3QAAAAAAAAPZ2V0X2xhdGVzdF9yb290AAAAAAAAAAABAAAD7gAAACA=",
            "AAAABAAAAAAAAAAAAAAADVNvbHZlbmN5RXJyb3IAAAAAAAADAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAElVuYXV0aG9yaXplZE9yYWNsZQAAAAAAAgAAAAAAAAAOU3RhbGVUaW1lc3RhbXAAAAAAAAM="]), options);
        this.options = options;
    }
    fromJSON = {
        initialize: (this.txFromJSON),
        publish_root: (this.txFromJSON),
        get_latest_root: (this.txFromJSON)
    };
}
