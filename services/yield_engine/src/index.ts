import {
  Keypair,
  Contract,
  nativeToScVal,
  TransactionBuilder,
  Networks,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';

export class YieldSnapshotEngine {
  private contractId: string;
  private adminKeypair: Keypair;
  private rpcServer: SorobanRpc.Server;

  constructor(contractId: string, adminSecret: string, rpcUrl: string = 'https://soroban-testnet.stellar.org') {
    this.contractId = contractId;
    this.adminKeypair = Keypair.fromSecret(adminSecret);
    this.rpcServer = new SorobanRpc.Server(rpcUrl);
  }

  /**
   * Initializes the corporate action on-chain. Anchors the supply state instantly.
   */
  public async broadcastYieldSnapshot(totalSupply: bigint, totalYield: bigint): Promise<string> {
    console.log(`[SNAPSHOT] Freezing supply state at ${totalSupply} for yield distribution of ${totalYield}.`);
    
    const account = await this.rpcServer.getAccount(this.adminKeypair.publicKey());
    const contract = new Contract(this.contractId);
    
    const tx = new TransactionBuilder(account, { 
      fee: '2000', 
      networkPassphrase: Networks.TESTNET 
    })
      .addOperation(
        contract.call(
          'initialize_snapshot',
          nativeToScVal(this.adminKeypair.publicKey(), { type: 'address' }),
          nativeToScVal(totalSupply, { type: 'i128' }),
          nativeToScVal(totalYield, { type: 'i128' })
        )
      )
      .setTimeout(30)
      .build();

    const simulated = await this.rpcServer.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }
    
    const assembledTx = SorobanRpc.assembleTransaction(tx, simulated).build();
    assembledTx.sign(this.adminKeypair);

    const response = await this.rpcServer.sendTransaction(assembledTx);
    if (response.status === 'ERROR') {
      throw new Error(`Network transmission failed.`);
    }
    
    console.log(`[SUCCESS] Yield matrix initialized. Hash: ${response.hash}`);
    return response.hash;
  }
}
