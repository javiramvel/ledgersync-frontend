"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstitutionalGatewayEngine = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const axios_1 = __importDefault(require("axios"));
class InstitutionalGatewayEngine {
    amlOracleEndpoint;
    contractId;
    oracleKeypair;
    rpcServer;
    constructor(amlOracleEndpoint, contractId, oracleSecret, rpcUrl = 'https://soroban-testnet.stellar.org') {
        this.amlOracleEndpoint = amlOracleEndpoint;
        this.contractId = contractId;
        this.oracleKeypair = stellar_sdk_1.Keypair.fromSecret(oracleSecret);
        this.rpcServer = new stellar_sdk_1.rpc.Server(rpcUrl);
    }
    /**
     * Pings the off-chain entity registry. Fails safe (freezes) on timeout.
     */
    async checkWatchlistStatus(lei) {
        try {
            const response = await axios_1.default.get(`${this.amlOracleEndpoint}/check`, {
                params: { lei },
                timeout: 5000
            });
            return response.data.clear === true;
        }
        catch (error) {
            console.error('[CRITICAL ERROR] Watchlist timeout or failure. Defaulting to freeze state.', error);
            return false;
        }
    }
    /**
     * Compiles the transaction, simulates storage footprint, signs, and submits.
     */
    async broadcastFreeze(institutionWallet) {
        console.log(`[ACTION REQUIRED] Executing atomic on-chain freeze for: ${institutionWallet}`);
        const account = await this.rpcServer.getAccount(this.oracleKeypair.publicKey());
        const contract = new stellar_sdk_1.Contract(this.contractId);
        const tx = new stellar_sdk_1.TransactionBuilder(account, {
            fee: '1000',
            networkPassphrase: stellar_sdk_1.Networks.TESTNET
        })
            .addOperation(contract.call('update_compliance_status', (0, stellar_sdk_1.nativeToScVal)(institutionWallet, { type: 'address' }), (0, stellar_sdk_1.nativeToScVal)(false, { type: 'bool' })))
            .setTimeout(30)
            .build();
        const simulated = await this.rpcServer.simulateTransaction(tx);
        if (stellar_sdk_1.rpc.Api.isSimulationError(simulated)) {
            throw new Error(`Simulation failed: ${simulated.error}`);
        }
        const assembledTx = stellar_sdk_1.rpc.assembleTransaction(tx, simulated).build();
        assembledTx.sign(this.oracleKeypair);
        const response = await this.rpcServer.sendTransaction(assembledTx);
        if (response.status === 'ERROR') {
            throw new Error(`Transaction submission failed at network layer.`);
        }
        console.log(`[SUCCESS] Freeze executed. Hash: ${response.hash}`);
        return response.hash;
    }
}
exports.InstitutionalGatewayEngine = InstitutionalGatewayEngine;
