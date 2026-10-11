import {
  Keypair,
  Contract,
  nativeToScVal,
  TransactionBuilder,
  Networks,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';
import axios from 'axios';

export class InstitutionalGatewayEngine {
  private amlOracleEndpoint: string;
  private contractId: string;
  private oracleKeypair: Keypair;
  private rpcServer: SorobanRpc.Server;

  constructor(
    amlOracleEndpoint: string,
    contractId: string,
    oracleSecret: string,
    rpcUrl: string = 'https://soroban-testnet.stellar.org'
  ) {
    this.amlOracleEndpoint = amlOracleEndpoint;
    this.contractId = contractId;
    this.oracleKeypair = Keypair.fromSecret(oracleSecret);
    this.rpcServer = new SorobanRpc.Server(rpcUrl);
  }

  /**
   * Pings the off-chain entity registry. Fails safe (freezes) on timeout.
   */
  async checkWatchlistStatus(lei: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.amlOracleEndpoint}/check`, {
        params: { lei },
        timeout: 5000 
      });
      return response.data.clear === true;
    } catch (error) {
      console.error('[CRITICAL ERROR] Watchlist timeout or failure. Defaulting to freeze state.', error);
      return false;
    }
  }

  /**
   * Compiles the transaction, simulates storage footprint, signs, and submits.
   */
  async broadcastFreeze(institutionWallet: string): Promise<string> {
    console.log(`[ACTION REQUIRED] Executing atomic on-chain freeze for: ${institutionWallet}`);
    
    const account = await this.rpcServer.getAccount(this.oracleKeypair.publicKey());
    const contract = new Contract(this.contractId);
    
    const tx = new TransactionBuilder(account, { 
      fee: '1000', 
      networkPassphrase: Networks.TESTNET 
    })
      .addOperation(
        contract.call(
          'update_compliance_status',
          nativeToScVal(institutionWallet, { type: 'address' }),
          nativeToScVal(false, { type: 'bool' })
        )
      )
      .setTimeout(30)
      .build();

    const simulated = await this.rpcServer.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }
    
    const assembledTx = SorobanRpc.assembleTransaction(tx, simulated).build();
    assembledTx.sign(this.oracleKeypair);

    const response = await this.rpcServer.sendTransaction(assembledTx);
    if (response.status === 'ERROR') {
      throw new Error(`Transaction submission failed at network layer.`);
    }
    
    console.log(`[SUCCESS] Freeze executed. Hash: ${response.hash}`);
    return response.hash;
  }
}
