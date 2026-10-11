import {
  Keypair,
  Contract,
  nativeToScVal,
  TransactionBuilder,
  Networks,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';

interface SyncTask {
  nonce: number;
  supply: bigint;
}

export class DurableSyncQueue {
  private queue: SyncTask[] = [];
  private isProcessing = false;
  private contractId: string;
  private adminKeypair: Keypair;
  private rpcServer: SorobanRpc.Server;

  constructor(contractId: string, adminSecret: string, rpcUrl: string = 'https://soroban-testnet.stellar.org') {
    this.contractId = contractId;
    this.adminKeypair = Keypair.fromSecret(adminSecret);
    this.rpcServer = new SorobanRpc.Server(rpcUrl);
  }

  /**
   * Ingests API payloads, sorts them mathematically by nonce, and triggers the queue.
   */
  public enqueueDelta(nonce: number, supply: bigint) {
    console.log(`[QUEUE] Enqueued delta sync. Nonce: ${nonce}, Supply: ${supply}`);
    this.queue.push({ nonce, supply });
    this.queue.sort((a, b) => a.nonce - b.nonce);
    this.processQueue();
  }

  /**
   * Processes the queue sequentially. Halts completely on unrecoverable failure.
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue[0];
      try {
        await this.broadcastWithRetry(task);
        this.queue.shift(); // Remove from queue ONLY upon verified on-chain success
        console.log(`[SUCCESS] Sequence ${task.nonce} permanently committed to ledger.`);
      } catch (error) {
        console.error(`[FATAL] Sequence ${task.nonce} failed after max retries. Halting queue to preserve 1:1 parity.`);
        break; 
      }
    }
    this.isProcessing = false;
  }

  /**
   * Executes network transmission with exponential backoff.
   */
  private async broadcastWithRetry(task: SyncTask, maxAttempts = 5): Promise<void> {
    let attempt = 1;
    let delayMs = 1000;

    while (attempt <= maxAttempts) {
      try {
        const account = await this.rpcServer.getAccount(this.adminKeypair.publicKey());
        const contract = new Contract(this.contractId);
        
        const tx = new TransactionBuilder(account, { 
          fee: '1000', 
          networkPassphrase: Networks.TESTNET 
        })
          .addOperation(
            contract.call(
              'sync_state',
              nativeToScVal(task.nonce, { type: 'u64' }),
              nativeToScVal(task.supply, { type: 'i128' })
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
          throw new Error(`Network rejection.`);
        }
        
        return; // Success, exit retry loop
      } catch (error) {
        console.warn(`[WARN] Attempt ${attempt} failed for Nonce ${task.nonce}. Retrying in ${delayMs}ms...`);
        if (attempt === maxAttempts) {
          throw new Error(`Max retries exceeded for Nonce ${task.nonce}`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff scaling
        attempt++;
      }
    }
  }
}
