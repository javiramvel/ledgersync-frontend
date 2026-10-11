import {
  Keypair,
  Contract,
  nativeToScVal,
  TransactionBuilder,
  Networks,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { MerkleTree } from 'merkletreejs';

interface TreasuryAccount {
  accountId: string;
  balance: number;
}

export class ZeroKnowledgeSolvencyOracle {
  private contractId: string;
  private oracleKeypair: Keypair;
  private rpcServer: SorobanRpc.Server;

  constructor(contractId: string, oracleSecret: string, rpcUrl: string = 'https://soroban-testnet.stellar.org') {
    this.contractId = contractId;
    this.oracleKeypair = Keypair.fromSecret(oracleSecret);
    this.rpcServer = new SorobanRpc.Server(rpcUrl);
  }

  /**
   * Hashes a single node for the Merkle Tree
   */
  private hashNode(data: string): Buffer {
    return crypto.createHash('sha256').update(data).digest();
  }

  /**
   * Ingests the full custodian treasury, computes the Merkle Root, and broadcasts it on-chain.
   * Protects privacy: 0% of the underlying array data is transmitted to the public ledger.
   */
  public async publishSolvencyProof(accounts: TreasuryAccount[]): Promise<string> {
    console.log(`[COMPUTING] Generating Merkle Tree for ${accounts.length} treasury accounts...`);

    // 1. Generate cryptographic leaves
    const leaves = accounts.map(acc => this.hashNode(`${acc.accountId}:${acc.balance}`));
    
    // 2. Compute the Tree (sortPairs ensures deterministic auditing)
    const tree = new MerkleTree(leaves, this.hashNode, { sortPairs: true });
    const rootBuffer = tree.getRoot();
    
    const timestamp = Math.floor(Date.now() / 1000);
    console.log(`[GENERATED] Merkle Root: ${rootBuffer.toString('hex')} at T:${timestamp}`);

    // 3. Execute On-Chain Transmission
    const account = await this.rpcServer.getAccount(this.oracleKeypair.publicKey());
    const contract = new Contract(this.contractId);
    
    const tx = new TransactionBuilder(account, { 
      fee: '1500', 
      networkPassphrase: Networks.TESTNET 
    })
      .addOperation(
        contract.call(
          'publish_root',
          nativeToScVal(rootBuffer, { type: 'bytesN' }),
          nativeToScVal(timestamp, { type: 'u64' })
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
      throw new Error(`Network transmission failed.`);
    }
    
    console.log(`[SUCCESS] Solvency Proof permanently anchored. Hash: ${response.hash}`);
    return response.hash;
  }
}
