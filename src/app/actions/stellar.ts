"use server";

import * as StellarSdk from '@stellar/stellar-sdk';

export async function executeMintingTransaction(amount: string) {
    try {
        const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
        const networkPassphrase = StellarSdk.Networks.TESTNET;

        // 1. Generate Keypairs for Treasury and Broker-Dealer
        const issuerKeyPair = StellarSdk.Keypair.random(); 
        const distributionKeyPair = StellarSdk.Keypair.random(); 

        // 2. Fund via Friendbot (Parallel for speed)
        await Promise.all([
            fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(issuerKeyPair.publicKey())}`),
            fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(distributionKeyPair.publicKey())}`)
        ]);

        const asset = new StellarSdk.Asset("REFA", issuerKeyPair.publicKey());

        // 3. Set Compliance Flags (AUTH_REQUIRED & AUTH_REVOCABLE)
        let issuerAccount = await server.loadAccount(issuerKeyPair.publicKey());
        let tx = new StellarSdk.TransactionBuilder(issuerAccount, { fee: StellarSdk.BASE_FEE, networkPassphrase })
            .addOperation(StellarSdk.Operation.setOptions({ setFlags: StellarSdk.AuthRequiredFlag | StellarSdk.AuthRevocableFlag }))
            .setTimeout(30).build();
        tx.sign(issuerKeyPair);
        await server.submitTransaction(tx);

        // 4. Broker-Dealer establishes Trustline
        const distAccount = await server.loadAccount(distributionKeyPair.publicKey());
        tx = new StellarSdk.TransactionBuilder(distAccount, { fee: StellarSdk.BASE_FEE, networkPassphrase })
            .addOperation(StellarSdk.Operation.changeTrust({ asset: asset }))
            .setTimeout(30).build();
        tx.sign(distributionKeyPair);
        await server.submitTransaction(tx);

        // 5. Treasury Authorizes Broker-Dealer
        issuerAccount = await server.loadAccount(issuerKeyPair.publicKey());
        tx = new StellarSdk.TransactionBuilder(issuerAccount, { fee: StellarSdk.BASE_FEE, networkPassphrase })
            .addOperation(StellarSdk.Operation.setTrustLineFlags({
                trustor: distributionKeyPair.publicKey(),
                asset: asset,
                flags: { authorized: true }
            }))
            .setTimeout(30).build();
        tx.sign(issuerKeyPair);
        await server.submitTransaction(tx);

        // 6. Mint Shares
        issuerAccount = await server.loadAccount(issuerKeyPair.publicKey());
        tx = new StellarSdk.TransactionBuilder(issuerAccount, { fee: StellarSdk.BASE_FEE, networkPassphrase })
            .addOperation(StellarSdk.Operation.payment({
                destination: distributionKeyPair.publicKey(),
                asset: asset,
                amount: amount // Uses the amount passed from the frontend UI
            }))
            .setTimeout(30).build();
        tx.sign(issuerKeyPair);
        const result = await server.submitTransaction(tx);

        // Return the success state and hash back to the client UI
        return { success: true, hash: result.hash };
        
    } catch (error: any) {
        console.error("Smart Contract Execution Failed:", error);
        return { success: false, error: error.message || "Transaction failed on the Stellar network." };
    }
}
